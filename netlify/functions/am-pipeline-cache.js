// am-pipeline-cache.js  (round-end based report stall; rate-safe, resumable)
//
// Stall definition (per Joe):
//   - Universe = clients with an OPEN deal in CRS (45), PLUS clients in
//     Incomplete (71). Sold (7) is excluded because services have not started.
//   - Population = clients who STARTED a round (round 1, 2, or 3) within the last
//     90 days. A round is a DEAL date-range field: start at the key, end at key + '_until'.
//     Clients whose only rounds started more than 90 days ago are out entirely.
//   - Stalled = in that population AND person Update Status = Logins Not Ready (934)
//     AND it has been >= 14 days since the latest round end. No upper cap.
//   - Payment statuses and Check Logins are NOT counted here.
//
// Account Manager + Update Status are PERSON fields; round dates are DEAL fields.
// So phase 1 pages open deals (round start/end + pipeline), phase 2 pages people
// to read AM + status, then we join and score.
//
// Writes app_cache[am_pipeline_full] (read by am-stall-rate) and
// app_cache[am_person_to_am]. Progress: am_pipeline_progress_v5.

const PIPEDRIVE_TOKEN = process.env.PIPEDRIVE_API_KEY || '328f4866f7d86c2bfbee1ed8b5c1895a1f6444d0';
const PIPEDRIVE_DOMAIN = process.env.PIPEDRIVE_DOMAIN || 'asapcreditrepairusa';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ACCOUNT_MANAGER_FIELD = '0a2bceaec010dd949056d374970917a6b573f1dc';
const UPDATE_STATUS_FIELD = '6381d902f9c164217fbb0b5a6b98f10f1bce7fad';
const LOGINS_NOT_READY = 934;
const STALL_MIN_DAYS = 14;       // grace period after a round ends before Logins Not Ready counts
const START_WINDOW_DAYS = 90;    // a client is in scope only if a round STARTED within this many days
const PASTDUE_MIN_DAYS = 5;      // grace before an unpaid invoice counts against the AM
const PASTDUE_MAX_DAYS = 30;     // after this the client is a non-payer, not a collection miss, so it drops off

// Round date-range deal fields: start is stored at the key, end at key + '_until'.
const ROUND_KEYS = [
  '6979c70df67f42c28dfcff39284ae17d564d600f', // Round 1
  'ff3697496664744d64d9f290766f919f40c23aa0', // Round 2
  '8d681007c089ee4c7390c02ee2f027ca60374708'  // Round 3
];

const PIPELINES = { 45: 'CRS', 71: 'Incomplete' }; // Sold (7) excluded: services not started
const PIPELINE_IDS = new Set(Object.keys(PIPELINES).map(Number));
const PRIO = { CRS: 2, Incomplete: 1 };

const TIME_BUDGET_MS = 8500;
const CHECKPOINT_EVERY = 25;
const PROGRESS_KEY = 'am_pipeline_progress_v7';
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
const supaAuth = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

async function pdGet(path, retry = 1) {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1${path}${sep}api_token=${PIPEDRIVE_TOKEN}`);
  if (res.ok) return await res.json();
  if ((res.status === 429 || res.status >= 500) && retry > 0) { await new Promise(r => setTimeout(r, 2000)); return pdGet(path, retry - 1); }
  return { data: null, _failed: true, status: res.status };
}
function amNameOf(v) { if (!v) return null; if (typeof v === 'string') return v; return v.name || v.value || null; }
function statusIdOf(v) { if (v === null || v === undefined) return 0; if (typeof v === 'object') return Number(v.value ?? v.id) || 0; return Number(v) || 0; }
function parseDate(v) { if (!v) return null; const s = typeof v === 'object' ? (v.value || v.until) : v; const d = new Date(s); return isNaN(d) ? null : d; }
function daysBetween(a, b) { return Math.floor((a - b) / 86400000); }

async function readCache(key) {
  try { const res = await fetch(`${SUPABASE_URL}/rest/v1/app_cache?cache_key=eq.${key}&select=cache_value`, { headers: supaAuth }); if (res.ok) { const rows = await res.json(); if (rows[0]) return JSON.parse(rows[0].cache_value); } } catch (e) {}
  return null;
}
async function writeCache(key, data) {
  await fetch(`${SUPABASE_URL}/rest/v1/app_cache`, { method: 'POST', headers: { ...supaAuth, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ cache_key: key, cache_value: JSON.stringify(data), updated_at: new Date().toISOString() }) });
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
// All Zoho invoices, paged. Used at publish time to flag clients whose invoice is past due.
async function readInvoices() {
  const out = []; let offset = 0; const page = 1000;
  while (true) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/consultant_invoices?select=customer_name,due_date,balance,pipedrive_deal_id&offset=${offset}&limit=${page}`, { headers: supaAuth });
    if (!res.ok) break;
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    out.push(...batch);
    if (batch.length < page) break;
    offset += page;
    if (offset > 200000) break;
  }
  return out;
}
// Deal ids and customer names with an invoice 5 to 30 days past its due date and still owing.
async function pastDueSets() {
  const dealIds = new Set(), names = new Set();
  const today = Date.now();
  for (const inv of await readInvoices()) {
    const bal = parseFloat(inv.balance) || 0;
    if (bal <= 1 || !inv.due_date) continue;
    const due = parseDate(inv.due_date);
    if (!due) continue;
    const daysPast = Math.floor((today - due.getTime()) / 86400000);
    if (daysPast < PASTDUE_MIN_DAYS || daysPast > PASTDUE_MAX_DAYS) continue;
    if (inv.pipedrive_deal_id) dealIds.add(String(inv.pipedrive_deal_id));
    if (inv.customer_name) names.add(norm(inv.customer_name));
  }
  return { dealIds, names };
}

function roundDates(deal) {
  let maxStart = null, maxEnd = null;
  for (const k of ROUND_KEYS) {
    const s = parseDate(deal[k]);
    const e = parseDate(deal[k + '_until']);
    if (s && (!maxStart || s > maxStart)) maxStart = s;
    if (e && (!maxEnd || e > maxEnd)) maxEnd = e;
  }
  return { maxStart, maxEnd };
}

async function publish(personData, complete, extra) {
  // Past due is only needed when we are going to publish (a complete pass).
  const pd = complete ? await pastDueSets() : { dealIds: new Set(), names: new Set() };
  const isPastDue = (d) => pd.dealIds.has(String(d.dealId)) || pd.names.has(norm(d.name));
  const amStats = {}; const personToAM = {};
  let evaluated = 0, stalledTotal = 0, sample = [];
  for (const [id, d] of Object.entries(personData)) {
    personToAM[id] = d.am;
    if (!amStats[d.am]) amStats[d.am] = { evaluated: 0, stalled: 0, activeBook: 0, crsBook: 0, pastDue: 0, stalledClients: [], pastDueClients: [] };
    const s = amStats[d.am];
    s.activeBook++;
    // Payment past due is measured over the active CRS book only.
    if (d.pipeline === 'CRS') {
      s.crsBook++;
      if (isPastDue(d)) { s.pastDue++; s.pastDueClients.push({ name: d.name, id, dealId: d.dealId }); }
    }
    if (!d.inWindow) continue;       // only clients who started a round within 90 days are evaluated for stall
    s.evaluated++; evaluated++;
    if (d.stalled) {
      s.stalled++; stalledTotal++;
      s.stalledClients.push({ name: d.name, id, daysSinceRoundEnd: d.daysSince, pipeline: d.pipeline, reason: d.reason });
      if (sample.length < 5) sample.push({ name: d.name, daysSinceRoundEnd: d.daysSince, reason: d.reason });
    }
  }
  const results = {};
  for (const [am, s] of Object.entries(amStats)) {
    const reportStallRate = s.evaluated > 0 ? Math.round((s.stalled / s.evaluated) * 100) : null;
    const paymentPastDueRate = s.crsBook > 0 ? Math.round((s.pastDue / s.crsBook) * 100) : null;
    // Overall = simple average of the two rates, each kept over its own group. If one has no
    // group to measure, the overall is just the other.
    let overall = null;
    if (reportStallRate != null && paymentPastDueRate != null) overall = Math.round((reportStallRate + paymentPastDueRate) / 2);
    else if (reportStallRate != null) overall = reportStallRate;
    else if (paymentPastDueRate != null) overall = paymentPastDueRate;
    results[am] = {
      totalClients: s.evaluated,              // report stall denominator = round-started-within-90 clients
      activeBook: s.activeBook,
      crsBook: s.crsBook,                     // payment past due denominator
      reportStalled: s.stalled,
      reportStallRate: reportStallRate == null ? 0 : reportStallRate,
      reportStallRateNull: reportStallRate == null,
      paymentPastDue: s.pastDue,
      paymentPastDueRate: paymentPastDueRate == null ? 0 : paymentPastDueRate,
      paymentPastDueRateNull: paymentPastDueRate == null,
      overall: overall == null ? 0 : overall,
      overallNull: overall == null,
      paymentStalled: 0, paymentStallRate: 0, // legacy fields kept so older UI does not break
      stalledClients: s.stalledClients.slice(0, 50),
      pastDueClients: s.pastDueClients.slice(0, 50)
    };
  }
  const calculatedAt = new Date().toISOString();
  // Only publish to the live dashboard caches when a pass is COMPLETE. Partial
  // passes (e.g. a single scheduled chunk) must never overwrite the last good
  // snapshot with empty/half-built data.
  if (complete) {
    await writeCache('am_pipeline_full', { accountManagers: results, totalEvaluated: evaluated, totalStalled: stalledTotal, stallThresholdDays: STALL_MIN_DAYS, startWindowDays: START_WINDOW_DAYS, pastDueWindowDays: { min: PASTDUE_MIN_DAYS, max: PASTDUE_MAX_DAYS }, basis: 'round_start_90d_logins_not_ready', complete, calculatedAt, ...extra });
    await writeCache('am_person_to_am', { personToAM, calculatedAt });
  }
  return { managers: Object.keys(results).length, evaluated, stalledTotal, sample };
}

exports.handler = async (event) => {
  if (event && event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  const t0 = Date.now();
  const left = () => (Date.now() - t0) < TIME_BUDGET_MS;
  const now = new Date();
  try {
    const params = (event && event.queryStringParameters) || {};

    // Real AM roster (from the users table) so non-AMs never enter the metric.
    let rosterTokens = [];
    try {
      const amRes = await fetch(`${SUPABASE_URL}/rest/v1/users?department=eq.account_managers&select=name`, { headers: supaAuth });
      if (amRes.ok) {
        const amUsers = await amRes.json();
        rosterTokens = amUsers.flatMap(u => (u.name || '').toLowerCase().split(/[\s-]+/).filter(p => p.length > 2));
      }
    } catch (e) {}
    if (rosterTokens.length === 0) rosterTokens = ['dex-ann', 'dex', 'zairen', 'raquel', 'verzales', 'lanzas'];
    const EXCLUDE = ['rose', 'mariana', 'navarro']; // explicitly not Account Managers
    const rosterOk = (am) => {
      const l = (am || '').toLowerCase();
      if (EXCLUDE.some(x => l.includes(x))) return false;
      return rosterTokens.some(t => l.includes(t));
    };
    let pr = await readCache(PROGRESS_KEY);
    const fresh = params.reset === '1' || !pr || pr.complete;
    let phase = fresh ? 'deals' : (pr.phase || 'deals');
    let activeData = fresh ? {} : (pr.activeData || {});   // pid -> {pipeline, roundStart, roundEnd, dealId}
    let cursor = fresh ? 0 : (pr.cursor || 0);
    let personData = fresh ? {} : (pr.personData || {});
    let noAm = fresh ? 0 : (pr.noAm || 0);
    let pagesThisRun = 0;

    // PHASE 1: open deals -> active client set with round-end + pipeline + move date
    if (phase === 'deals') {
      let hasMore = true, aborted = false;
      while (hasMore && left()) {
        const res = await pdGet(`/deals?status=open&start=${cursor}&limit=500`);
        if (res._failed) { aborted = true; break; }
        const deals = res.data || [];
        for (const d of deals) {
          const plId = Number(d.pipeline_id);
          if (!PIPELINE_IDS.has(plId)) continue;
          const pid = d.person_id?.value || d.person_id || null;
          if (!pid) continue;
          const pipeName = PIPELINES[plId];
          // Incomplete is kept regardless of when it was moved; the round-start-within-90-days
          // gate in phase 2 decides whether the client actually counts.
          const { maxStart, maxEnd } = roundDates(d);
          const existing = activeData[pid];
          const better = !existing || PRIO[pipeName] > PRIO[existing.pipeline] || (!existing.roundStart && maxStart);
          if (better) activeData[pid] = { pipeline: pipeName, roundStart: maxStart ? maxStart.toISOString() : null, roundEnd: maxEnd ? maxEnd.toISOString() : null, dealId: d.id };
        }
        hasMore = res.additional_data?.pagination?.more_items_in_collection || false;
        cursor = res.additional_data?.pagination?.next_start || (cursor + 500);
        pagesThisRun++;
        if (deals.length === 0) hasMore = false;
        if (pagesThisRun % CHECKPOINT_EVERY === 0) await writeCache(PROGRESS_KEY, { phase, activeData, cursor, personData, noAm, complete: false });
      }
      if (!hasMore && !aborted) { phase = 'persons'; cursor = 0; }
    }

    // PHASE 2: page people, read AM + Update Status, join with round data, score
    if (phase === 'persons') {
      let hasMore = true, aborted = false;
      while (hasMore && left()) {
        const res = await pdGet(`/persons?start=${cursor}&limit=500`);
        if (res._failed) { aborted = true; break; }
        const persons = res.data || [];
        for (const p of persons) {
          const ad = activeData[p.id];
          if (!ad) continue;
          const am = amNameOf(p[ACCOUNT_MANAGER_FIELD]);
          if (!am || am === 'null') { noAm++; continue; }
          if (!rosterOk(am)) continue; // skip non-AMs (e.g., Rose, Mariana)
          const statusId = statusIdOf(p[UPDATE_STATUS_FIELD]);
          const rs = ad.roundStart ? new Date(ad.roundStart) : null;
          const re = ad.roundEnd ? new Date(ad.roundEnd) : null;
          // Population: the client started a round (1, 2, or 3) within the last 90 days.
          const startedWithin90 = !!(rs && rs <= now && daysBetween(now, rs) <= START_WINDOW_DAYS);
          const roundEnded = !!(re && re <= now);
          const daysSince = roundEnded ? daysBetween(now, re) : null;
          const inWindow = startedWithin90;
          let stalled = false, reason = null;
          // Stalled: in the population, still Logins Not Ready, and 14+ days past the latest round end.
          if (inWindow && statusId === LOGINS_NOT_READY && roundEnded && daysSince >= STALL_MIN_DAYS) {
            stalled = true; reason = `Logins Not Ready ${daysSince}d past round end`;
          }
          personData[p.id] = { am, statusId, name: p.name, pipeline: ad.pipeline, dealId: ad.dealId, roundEnded, daysSince, inWindow, stalled, reason };
        }
        hasMore = res.additional_data?.pagination?.more_items_in_collection || false;
        cursor = res.additional_data?.pagination?.next_start || (cursor + 500);
        pagesThisRun++;
        if (persons.length === 0) hasMore = false;
        if (pagesThisRun % CHECKPOINT_EVERY === 0) await writeCache(PROGRESS_KEY, { phase, activeData, cursor, personData, noAm, complete: false });
      }
      if (!hasMore && !aborted) phase = 'done';
    }

    const complete = phase === 'done';
    const summary = await publish(personData, complete, { activeClients: Object.keys(activeData).length, clientsWithoutAM: noAm });
    await writeCache(PROGRESS_KEY, { phase: complete ? 'done' : phase, activeData, cursor, personData, noAm, complete });

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        ok: true, complete, phase, pagesThisRun,
        activeClients: Object.keys(activeData).length, enriched: Object.keys(personData).length,
        evaluated: summary.evaluated, stalled: summary.stalledTotal, managers: summary.managers,
        clientsWithoutAM: noAm, sampleStalled: summary.sample,
        note: complete ? 'Full pass complete.' : 'Partial pass saved; run again.'
      })
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
