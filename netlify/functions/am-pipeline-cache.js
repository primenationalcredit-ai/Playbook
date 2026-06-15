// am-pipeline-cache.js  (round-end based report stall; rate-safe, resumable)
//
// Stall definition (per Joe):
//   - Universe = live clients with an OPEN deal in CRS (45) or Sold (7), PLUS
//     clients moved to Incomplete (71) in the CURRENT calendar month (so an AM
//     can't dump a post-round client into Incomplete to hide it).
//   - "Round is over" = the latest round END date on the deal has passed.
//     Round dates are DEAL date-range fields; end is stored at key + '_until'.
//   - Denominator = clients whose round is over.
//   - Stalled = round over AND person Update Status = Logins Not Ready (934) AND
//     it has been >= 14 days since the round end. Incomplete-this-month + round
//     over also counts as stalled.
//   - Payment statuses and the mixed "Round Done Need Reports/Payment" are NOT
//     counted. Check Logins is NOT counted.
//
// Account Manager + Update Status are PERSON fields; round dates are DEAL fields.
// So phase 1 pages open deals (round dates + which pipeline + move date), phase 2
// pages people to read AM + status, then we join and score.
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
const STALL_MIN_DAYS = 14;   // grace period after round end before it counts
const STALL_MAX_DAYS = 120;  // beyond this the client is cleanup, not a current stall

// Round date-range deal fields (start at key, end at key + '_until')
const ROUND_END_FIELDS = [
  '6979c70df67f42c28dfcff39284ae17d564d600f_until', // Round 1 end
  'ff3697496664744d64d9f290766f919f40c23aa0_until', // Round 2 end
  '8d681007c089ee4c7390c02ee2f027ca60374708_until'  // Round 3 end
];

const PIPELINES = { 45: 'CRS', 7: 'Sold', 71: 'Incomplete' };
const PIPELINE_IDS = new Set(Object.keys(PIPELINES).map(Number));
const PRIO = { CRS: 3, Sold: 2, Incomplete: 1 };

const TIME_BUDGET_MS = 8500;
const CHECKPOINT_EVERY = 25;
const PROGRESS_KEY = 'am_pipeline_progress_v6';
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

function roundEndOfDeal(deal) {
  const ends = ROUND_END_FIELDS.map(k => parseDate(deal[k])).filter(Boolean);
  if (!ends.length) return null;
  return new Date(Math.max(...ends.map(d => d.getTime())));
}

async function publish(personData, complete, extra) {
  const today = new Date();
  const amStats = {}; const personToAM = {};
  let evaluated = 0, stalledTotal = 0, sample = [];
  for (const [id, d] of Object.entries(personData)) {
    personToAM[id] = d.am;
    if (!amStats[d.am]) amStats[d.am] = { evaluated: 0, stalled: 0, activeBook: 0, stalledClients: [] };
    const s = amStats[d.am];
    s.activeBook++;
    if (!d.inWindow) continue;       // only clients in the 14-120 day window are evaluated
    s.evaluated++; evaluated++;
    if (d.stalled) {
      s.stalled++; stalledTotal++;
      s.stalledClients.push({ name: d.name, id, daysSinceRoundEnd: d.daysSince, pipeline: d.pipeline, reason: d.reason });
      if (sample.length < 5) sample.push({ name: d.name, daysSinceRoundEnd: d.daysSince, reason: d.reason });
    }
  }
  const results = {};
  for (const [am, s] of Object.entries(amStats)) {
    results[am] = {
      totalClients: s.evaluated,              // denominator = round-over clients
      activeBook: s.activeBook,
      reportStalled: s.stalled,
      reportStallRate: s.evaluated > 0 ? Math.round((s.stalled / s.evaluated) * 100) : 0,
      paymentStalled: 0, paymentStallRate: 0, // payment never penalizes
      stalledClients: s.stalledClients.slice(0, 50)
    };
  }
  const calculatedAt = new Date().toISOString();
  await writeCache('am_pipeline_full', { accountManagers: results, totalEvaluated: evaluated, totalStalled: stalledTotal, stallThresholdDays: STALL_MIN_DAYS, stallWindowDays: { min: STALL_MIN_DAYS, max: STALL_MAX_DAYS }, basis: 'round_end_logins_not_ready', complete, calculatedAt, ...extra });
  await writeCache('am_person_to_am', { personToAM, calculatedAt });
  return { managers: Object.keys(results).length, evaluated, stalledTotal, sample };
}

exports.handler = async (event) => {
  if (event && event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  const t0 = Date.now();
  const left = () => (Date.now() - t0) < TIME_BUDGET_MS;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  try {
    const params = (event && event.queryStringParameters) || {};
    let pr = await readCache(PROGRESS_KEY);
    const fresh = params.reset === '1' || !pr || pr.complete;
    let phase = fresh ? 'deals' : (pr.phase || 'deals');
    let activeData = fresh ? {} : (pr.activeData || {});   // pid -> {pipeline, roundEnd, movedThisMonth, dealId}
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
          let movedThisMonth = false;
          if (plId === 71) {
            // Only the stage-change date marks an actual move into Incomplete.
            // update_time changes on every sync/touch, so it is NOT a valid signal.
            const moved = parseDate(d.stage_change_time);
            if (!moved || moved < monthStart) continue; // skip old Incompletes
            movedThisMonth = true;
          }
          const re = roundEndOfDeal(d);
          const existing = activeData[pid];
          const better = !existing || PRIO[pipeName] > PRIO[existing.pipeline] || (!existing.roundEnd && re);
          if (better) activeData[pid] = { pipeline: pipeName, roundEnd: re ? re.toISOString() : null, movedThisMonth, dealId: d.id };
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
          const statusId = statusIdOf(p[UPDATE_STATUS_FIELD]);
          const re = ad.roundEnd ? new Date(ad.roundEnd) : null;
          const roundOver = !!(re && re <= now);
          const daysSince = roundOver ? daysBetween(now, re) : null;
          // Only clients whose round ended 14-120 days ago are in scope.
          const inWindow = roundOver && daysSince >= STALL_MIN_DAYS && daysSince <= STALL_MAX_DAYS;
          let stalled = false, reason = null;
          if (inWindow && statusId === LOGINS_NOT_READY) { stalled = true; reason = `Logins Not Ready ${daysSince}d past round end`; }
          else if (inWindow && ad.pipeline === 'Incomplete' && ad.movedThisMonth) { stalled = true; reason = `Moved to Incomplete this month, round over (${daysSince}d)`; }
          personData[p.id] = { am, statusId, name: p.name, pipeline: ad.pipeline, roundOver, daysSince, inWindow, stalled, reason };
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
