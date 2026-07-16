// am-pipeline-cache.js  (round-end based report stall; rate-safe, resumable)
//
// Stall definition (per Joe and Astrid):
//   - Universe = clients with an OPEN deal in CRS (45), PLUS clients in
//     Incomplete (71). Sold (7) is excluded because services have not started.
//   - Population = clients whose LATEST round (1, 2, or 3) STARTED 45 to 90 days
//     ago. The 45 day floor removes mid-round clients whose current round is
//     still running and therefore can't be stalled yet.
//   - Stalled = in that population AND person Update Status = Logins Not Ready (934)
//     AND it has been >= 14 days since the latest round end. No upper cap.
//   - Payment statuses and Check Logins are NOT counted here.
//
// Payment Past Due (separate from Reports Stall):
//   - Denominator = CRS clients with at least one invoice whose original due date
//     is in the last 30 days, whether they paid or not.
//   - Numerator = subset whose invoice is 5 or more days past its original due
//     date and still has a balance owing. The 5 day grace ignores payments in
//     transit. Anything past 30 days drops off the denominator naturally, so the
//     client stops counting once they are a clear non-payer.
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
const PAYMENT_STALL_IDS = new Set([1616, 1777, 1861]); // OWES MONEY family - payment bucket, not report population
const STALL_MIN_DAYS = 14;            // grace period after a round ends before Logins Not Ready counts
const START_WINDOW_MIN_DAYS = 45;     // round must have started at least this long ago to be evaluated (cuts out mid-round)
const START_WINDOW_MAX_DAYS = 90;     // and no more than this long ago (cuts out end-of-service / old clients)
const PASTDUE_MIN_DAYS = 5;           // grace before an unpaid invoice counts against the AM
const PAYMENT_WINDOW_DAYS = 30;       // a client is in the payment denominator only if their original due date is within the last 30 days

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
// Doc-fee payments actually received, keyed by deal id and by normalized client
// name, as CONSUMABLE counts (amount -> how many doc fees of that amount were paid).
// Used to forgive accidental duplicate doc-fee invoices: when a client was billed
// two doc fees by mistake and paid one, the unpaid duplicate keeps its full balance
// and would otherwise be flagged past due. We forgive at most one duplicate per paid
// doc fee of the same amount, so a client who truly never paid still counts.
async function readDocFeePaid() {
  const byDeal = new Map(), byName = new Map();
  const bump = (map, key, amt) => {
    if (!key) return;
    const r = Math.round(parseFloat(amt) || 0);
    if (r <= 0) return;
    let inner = map.get(key);
    if (!inner) { inner = new Map(); map.set(key, inner); }
    inner.set(r, (inner.get(r) || 0) + 1);
  };
  let offset = 0; const page = 1000;
  while (true) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/consultant_payments?payment_type=eq.doc_fee&select=client_name,pipedrive_deal_id,amount&offset=${offset}&limit=${page}`, { headers: supaAuth });
    if (!res.ok) break;
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    for (const p of batch) {
      if (p.pipedrive_deal_id) bump(byDeal, String(p.pipedrive_deal_id), p.amount);
      if (p.client_name) bump(byName, norm(p.client_name), p.amount);
    }
    if (batch.length < page) break;
    offset += page;
    if (offset > 200000) break;
  }
  return { byDeal, byName };
}
//   - inWindow: clients with at least one invoice whose original due date is in
//     the last 30 days (any balance, paid or unpaid). This is the denominator.
//   - pastDue: subset whose invoice is >= 5 days past its due date AND still has
//     a balance > $1. This is the numerator. Carries the worst invoice's details
//     (most days past due) for the breakdown UI.
async function paymentClassification() {
  const inWindowDeal = new Set(), inWindowName = new Set();
  const pastDueDeal = new Map(), pastDueName = new Map();
  const today = Date.now();
  const consider = (key, map, entry) => {
    const prev = map.get(key);
    if (!prev || entry.daysPastDue > prev.daysPastDue) map.set(key, entry);
  };

  // Consumable copy of paid doc fees. When a past-due invoice's balance matches a
  // doc fee the client already paid, treat it as the accidental duplicate and skip
  // it. Consuming the count means one paid doc fee forgives exactly one duplicate.
  const docPaid = await readDocFeePaid();
  const dealLeft = new Map(); for (const [k, m] of docPaid.byDeal) dealLeft.set(k, new Map(m));
  const nameLeft = new Map(); for (const [k, m] of docPaid.byName) nameLeft.set(k, new Map(m));
  const forgiveDuplicate = (dealKey, nameKey, roundedBal) => {
    for (const [leftMap, key] of [[dealLeft, dealKey], [nameLeft, nameKey]]) {
      if (!key) continue;
      const inner = leftMap.get(key);
      if (inner && (inner.get(roundedBal) || 0) > 0) {
        inner.set(roundedBal, inner.get(roundedBal) - 1);
        return true;
      }
    }
    return false;
  };

  for (const inv of await readInvoices()) {
    if (!inv.due_date) continue;
    const due = parseDate(inv.due_date);
    if (!due) continue;
    const daysPastDue = Math.floor((today - due.getTime()) / 86400000);
    // Denominator window: due date was within the last 30 days (today through 30 days ago).
    // Anything older drops off naturally so non-payers stop counting.
    if (daysPastDue < 0 || daysPastDue > PAYMENT_WINDOW_DAYS) continue;
    const dealKey = inv.pipedrive_deal_id ? String(inv.pipedrive_deal_id) : null;
    const nameKey = inv.customer_name ? norm(inv.customer_name) : null;
    if (dealKey) inWindowDeal.add(dealKey);
    if (nameKey) inWindowName.add(nameKey);
    // Numerator: 5+ days past due and still owing.
    const bal = parseFloat(inv.balance) || 0;
    if (daysPastDue >= PASTDUE_MIN_DAYS && bal > 1) {
      const roundedBal = Math.round(bal);
      // Accidental duplicate doc-fee invoice already satisfied by the real doc-fee
      // payment -> do not count as past due. Client stays in the denominator (in
      // window) but is treated as on time.
      if (forgiveDuplicate(dealKey, nameKey, roundedBal)) continue;
      const entry = { dueDate: String(inv.due_date).slice(0, 10), daysPastDue, balance: roundedBal };
      if (dealKey) consider(dealKey, pastDueDeal, entry);
      if (nameKey) consider(nameKey, pastDueName, entry);
    }
  }
  return { inWindowDeal, inWindowName, pastDueDeal, pastDueName };
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
  // Payment classification is only needed when we are going to publish (a complete pass).
  const pc = complete ? await paymentClassification() : { inWindowDeal: new Set(), inWindowName: new Set(), pastDueDeal: new Map(), pastDueName: new Map() };
  const hasPaymentDue = (d) => pc.inWindowDeal.has(String(d.dealId)) || pc.inWindowName.has(norm(d.name));
  const pastDueDetails = (d) => pc.pastDueDeal.get(String(d.dealId)) || pc.pastDueName.get(norm(d.name)) || null;
  const amStats = {}; const personToAM = {};
  let evaluated = 0, stalledTotal = 0, sample = [];
  for (const [id, d] of Object.entries(personData)) {
    personToAM[id] = d.am;
    if (!amStats[d.am]) amStats[d.am] = {
      evaluated: 0, stalled: 0, activeBook: 0, crsBook: 0,
      paymentDue: 0, pastDue: 0,
      stalledClients: [], healthyInWindow: [],
      pastDueClients: [], paymentOnTime: []
    };
    const s = amStats[d.am];
    s.activeBook++;
    // Payment past due is measured over CRS clients who had an invoice due in the last 30 days.
    if (d.pipeline === 'CRS') {
      s.crsBook++;
      if (hasPaymentDue(d)) {
        s.paymentDue++;
        const pdHit = pastDueDetails(d);
        if (pdHit) {
          s.pastDue++;
          s.pastDueClients.push({ name: d.name, id, dealId: d.dealId, dueDate: pdHit.dueDate, daysPastDue: pdHit.daysPastDue, balance: pdHit.balance });
        } else {
          s.paymentOnTime.push({ name: d.name, id, dealId: d.dealId });
        }
      }
    }
    if (!d.inWindow) continue;       // only clients whose latest round started 45 to 90 days ago are evaluated for stall
    s.evaluated++; evaluated++;
    if (d.stalled) {
      s.stalled++; stalledTotal++;
      s.stalledClients.push({ name: d.name, id, dealId: d.dealId, daysSinceRoundEnd: d.daysSince, roundEndDate: d.roundEndDate, pipeline: d.pipeline, reason: d.reason });
      if (sample.length < 5) sample.push({ name: d.name, daysSinceRoundEnd: d.daysSince, reason: d.reason });
    } else {
      s.healthyInWindow.push({ name: d.name, id, dealId: d.dealId, daysSinceRoundEnd: d.roundEnded ? d.daysSince : null, roundEndDate: d.roundEndDate, roundEnded: d.roundEnded });
    }
  }
  const results = {};
  for (const [am, s] of Object.entries(amStats)) {
    const reportStallRate = s.evaluated > 0 ? Math.round((s.stalled / s.evaluated) * 100) : null;
    const paymentPastDueRate = s.paymentDue > 0 ? Math.round((s.pastDue / s.paymentDue) * 100) : null;
    let overall = null;
    if (reportStallRate != null && paymentPastDueRate != null) overall = Math.round((reportStallRate + paymentPastDueRate) / 2);
    else if (reportStallRate != null) overall = reportStallRate;
    else if (paymentPastDueRate != null) overall = paymentPastDueRate;
    const sortByName = (a, b) => String(a.name || '').localeCompare(String(b.name || ''));
    results[am] = {
      totalClients: s.evaluated,
      activeBook: s.activeBook,
      crsBook: s.crsBook,
      paymentDue: s.paymentDue,           // new denominator for payment past due
      reportStalled: s.stalled,
      reportStallRate: reportStallRate == null ? 0 : reportStallRate,
      reportStallRateNull: reportStallRate == null,
      paymentPastDue: s.pastDue,
      paymentPastDueRate: paymentPastDueRate == null ? 0 : paymentPastDueRate,
      paymentPastDueRateNull: paymentPastDueRate == null,
      overall: overall == null ? 0 : overall,
      overallNull: overall == null,
      paymentStalled: 0, paymentStallRate: 0,
      stalledClients: s.stalledClients.sort((a, b) => (b.daysSinceRoundEnd || 0) - (a.daysSinceRoundEnd || 0)).slice(0, 500),
      healthyInWindow: s.healthyInWindow.sort(sortByName).slice(0, 1000),
      pastDueClients: s.pastDueClients.sort((a, b) => (b.daysPastDue || 0) - (a.daysPastDue || 0)).slice(0, 500),
      paymentOnTime: s.paymentOnTime.sort(sortByName).slice(0, 1000)
    };
  }
  const calculatedAt = new Date().toISOString();
  if (complete) {
    await writeCache('am_pipeline_full', { accountManagers: results, totalEvaluated: evaluated, totalStalled: stalledTotal, stallThresholdDays: STALL_MIN_DAYS, startWindowDays: { min: START_WINDOW_MIN_DAYS, max: START_WINDOW_MAX_DAYS }, paymentWindowDays: PAYMENT_WINDOW_DAYS, pastDueMinDays: PASTDUE_MIN_DAYS, basis: 'round_start_45_90d_logins_not_ready', complete, calculatedAt, ...extra });
    await writeCache('am_person_to_am', { personToAM, calculatedAt });
    // dealId -> Update Status option id, for the credit-team cohort metric (bucketing + payment exclusion)
    const dealStatus = {};
    for (const pd of Object.values(personData)) { if (pd.dealId != null) dealStatus[String(pd.dealId)] = pd.statusId != null ? pd.statusId : null; }
    await writeCache('am_deal_status', { dealStatus, calculatedAt });
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
      // Stage names (id -> name) so additional-round deals can be excluded in phase 2.
      let stageNameById = {};
      try {
        const stRes = await pdGet('/stages');
        for (const stg of stRes.data || []) stageNameById[Number(stg.id)] = String(stg.name || '');
      } catch (e) {}
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
          if (better) activeData[pid] = { pipeline: pipeName, roundStart: maxStart ? maxStart.toISOString() : null, roundEnd: maxEnd ? maxEnd.toISOString() : null, dealId: d.id, stageName: stageNameById[Number(d.stage_id)] || '' };
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
      // Update Status option labels (id -> label) for the population exclusions below.
      let statusLabelById = {};
      try {
        const pfRes = await pdGet('/personFields');
        const usf = (pfRes.data || []).find(fl => fl.key === UPDATE_STATUS_FIELD);
        for (const o of (usf && usf.options) || []) statusLabelById[Number(o.id)] = String(o.label || '');
      } catch (e) {}
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
          // Population: the latest round started 45 to 90 days ago. The 45 day floor
          // cuts out clients whose current round is still mid-run; the 90 day ceiling
          // keeps the metric focused on recent activity.
          const daysSinceStart = rs && rs <= now ? daysBetween(now, rs) : null;
          const startedInWindow = daysSinceStart != null && daysSinceStart >= START_WINDOW_MIN_DAYS && daysSinceStart <= START_WINDOW_MAX_DAYS;
          const roundEnded = !!(re && re <= now);
          const daysSince = roundEnded ? daysBetween(now, re) : null;
          let inWindow = startedInWindow;
          let excludedWhy = null;
          if (inWindow && /additional/i.test(ad.stageName || '')) {
            // Additional-round cycle: not part of the original-service report population.
            inWindow = false; excludedWhy = 'additional-round';
          }
          if (inWindow) {
            const statusLabel = statusLabelById[statusId] || '';
            if (PAYMENT_STALL_IDS.has(statusId) || /owes money|waiting on \$\$\$/i.test(statusLabel)) {
              // Payment-blocked: tracked under the payment stall bucket, not report On-Time.
              inWindow = false; excludedWhy = 'payment-blocked';
            } else if (/rd\s*3.*results\s*sent|results\s*sent.*rd\s*3|service\s*complete|program\s*complete|all\s*rounds\s*(done|complete)/i.test(statusLabel)) {
              // Service complete: final results sent - nothing left to stall.
              inWindow = false; excludedWhy = 'service-complete';
            }
          }
          let stalled = false, reason = null;
          // Stalled: in the population, still Logins Not Ready, and 14+ days past the latest round end.
          if (inWindow && statusId === LOGINS_NOT_READY && roundEnded && daysSince >= STALL_MIN_DAYS) {
            stalled = true; reason = `Logins Not Ready ${daysSince}d past round end`;
          }
          personData[p.id] = { am, statusId, name: p.name, pipeline: ad.pipeline, dealId: ad.dealId, roundEnded, daysSince, roundEndDate: re ? re.toISOString().slice(0, 10) : null, inWindow, stalled, reason, excludedWhy };
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
