// stall-sync.js  (Playbook, scheduled)
// -----------------------------------------------------------------------------
// Computes the AM Reports Stall population from Pipedrive and stores it in the
// Supabase `stall_clients` table. The AM dashboard reads the rate from that
// table (always complete, instant) instead of scanning Pipedrive live.
//
// This is intentionally SEPARATE from am-pipeline-cache.js. It writes only the
// stall population (deals in CRS/Incomplete whose latest round started 45-90
// days ago), which is a few hundred rows, so it completes in a single run.
//
// Stall rules (per Astrid, identical to am-pipeline-cache):
//   Population = OPEN deal in CRS(45) or Incomplete(71), has an Account Manager,
//     and latest round (1-4) STARTED 45 to 90 days ago.
//   Stalled = in population AND Update Status = "LOGINS NOT READY (INDIVIDUAL)"
//     (option 934) AND latest round ENDED >= 14 days ago.
//
// Manual use:  ?dryRun=1  -> returns computed counts, writes nothing.
// -----------------------------------------------------------------------------

const PIPEDRIVE_TOKEN = process.env.PIPEDRIVE_API_KEY || '328f4866f7d86c2bfbee1ed8b5c1895a1f6444d0';
const PIPEDRIVE_DOMAIN = 'asapcreditrepairusa';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ACCOUNT_MANAGER_FIELD = '0a2bceaec010dd949056d374970917a6b573f1dc';
const UPDATE_STATUS_FIELD = '6381d902f9c164217fbb0b5a6b98f10f1bce7fad';
const LOGINS_NOT_READY = 934;
const STALL_MIN_DAYS = 14;
const START_WINDOW_MIN_DAYS = 45;
const START_WINDOW_MAX_DAYS = 90;

// Round date-range deal fields: start at the key, end at key + '_until'.
const ROUND_KEYS = [
  '6979c70df67f42c28dfcff39284ae17d564d600f', // Round 1
  'ff3697496664744d64d9f290766f919f40c23aa0', // Round 2
  '8d681007c089ee4c7390c02ee2f027ca60374708', // Round 3
];
const PIPELINES = { 45: 'CRS', 71: 'Incomplete' };
const PIPELINE_IDS = new Set(Object.keys(PIPELINES).map(Number));

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
const supaAuth = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

function parseDate(v) {
  if (!v) return null;
  const s = String(v).slice(0, 10);
  const d = new Date(s + 'T00:00:00Z');
  return isNaN(d.getTime()) ? null : d;
}
function daysBetween(a, b) { return Math.floor((a - b) / 86400000); }
function statusIdOf(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'object') return Number(v.id || v.value || 0) || 0;
  return Number(v) || 0;
}
function amNameOf(v) {
  if (!v) return null;
  if (typeof v === 'string') return v.trim() || null;
  return (v.name || v.value || '').toString().trim() || null;
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

async function pdGet(path) {
  const sep = path.includes('?') ? '&' : '?';
  const url = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1${path}${sep}api_token=${PIPEDRIVE_TOKEN}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url);
    if (res.ok) return await res.json();
    if (res.status === 429 || res.status >= 500) { await new Promise(r => setTimeout(r, 1500)); continue; }
    return { data: null, _failed: true, status: res.status };
  }
  return { data: null, _failed: true };
}

exports.handler = async (event) => {
  if (event && event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  const dryRun = event && event.queryStringParameters && (event.queryStringParameters.dryRun === '1' || event.queryStringParameters.dryRun === 'true');
  const now = new Date();

  try {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Supabase env not configured' }) };
    }

    // PHASE 1: page all OPEN deals in CRS/Incomplete -> activeData[personId] = round dates + pipeline + dealId
    const activeData = {}; // pid -> { pipeline, roundStart(Date), roundEnd(Date), dealId }
    let cursor = 0, hasMore = true, pages = 0;
    while (hasMore) {
      const res = await pdGet(`/deals?status=open&start=${cursor}&limit=500`);
      if (res._failed) return { statusCode: 502, headers, body: JSON.stringify({ error: 'Pipedrive deals fetch failed', status: res.status }) };
      const deals = res.data || [];
      for (const d of deals) {
        const plId = Number(d.pipeline_id);
        if (!PIPELINE_IDS.has(plId)) continue;
        const pid = d.person_id?.value || d.person_id || null;
        if (!pid) continue;
        const { maxStart, maxEnd } = roundDates(d);
        const existing = activeData[pid];
        // Prefer the deal with the latest round start (matches "newest round wins")
        const better = !existing || (maxStart && (!existing.roundStart || maxStart > existing.roundStart));
        if (better) activeData[pid] = { pipeline: PIPELINES[plId], roundStart: maxStart, roundEnd: maxEnd, dealId: d.id };
      }
      hasMore = res.additional_data?.pagination?.more_items_in_collection || false;
      cursor = res.additional_data?.pagination?.next_start || (cursor + 500);
      pages++;
      if (deals.length === 0) hasMore = false;
      if (pages > 60) break; // safety cap
    }

    // PHASE 2: page persons, join to activeData, apply the window + stall rules
    const rows = [];
    let pcursor = 0, phasMore = true, ppages = 0;
    while (phasMore) {
      const res = await pdGet(`/persons?start=${pcursor}&limit=500`);
      if (res._failed) return { statusCode: 502, headers, body: JSON.stringify({ error: 'Pipedrive persons fetch failed', status: res.status }) };
      const persons = res.data || [];
      for (const p of persons) {
        const ad = activeData[p.id];
        if (!ad || !ad.roundStart) continue;
        const daysSinceStart = ad.roundStart <= now ? daysBetween(now, ad.roundStart) : null;
        if (daysSinceStart === null || daysSinceStart < START_WINDOW_MIN_DAYS || daysSinceStart > START_WINDOW_MAX_DAYS) continue; // not in population
        const am = amNameOf(p[ACCOUNT_MANAGER_FIELD]);
        if (!am) continue; // population requires an AM
        const statusId = statusIdOf(p[UPDATE_STATUS_FIELD]);
        const roundEnded = !!(ad.roundEnd && ad.roundEnd <= now);
        const daysSinceEnd = roundEnded ? daysBetween(now, ad.roundEnd) : null;
        const isStalled = statusId === LOGINS_NOT_READY && roundEnded && daysSinceEnd >= STALL_MIN_DAYS;
        rows.push({
          deal_id: ad.dealId,
          client_name: (p.name || '').slice(0, 120),
          account_manager: am.slice(0, 80),
          update_status: (typeof p[UPDATE_STATUS_FIELD] === 'object' ? (p[UPDATE_STATUS_FIELD]?.name || String(statusId)) : String(p[UPDATE_STATUS_FIELD] ?? '')).slice(0, 80),
          pipeline: ad.pipeline,
          round_start: ad.roundStart.toISOString().slice(0, 10),
          round_end: ad.roundEnd ? ad.roundEnd.toISOString().slice(0, 10) : null,
          days_since_start: daysSinceStart,
          days_since_end: daysSinceEnd,
          in_population: true,
          is_stalled: isStalled,
        });
      }
      phasMore = res.additional_data?.pagination?.more_items_in_collection || false;
      pcursor = res.additional_data?.pagination?.next_start || (pcursor + 500);
      ppages++;
      if (persons.length === 0) phasMore = false;
      if (ppages > 60) break; // safety cap
    }

    // Per-AM summary (for the response + easy verification)
    const summary = {};
    for (const r of rows) {
      if (!summary[r.account_manager]) summary[r.account_manager] = { population: 0, stalled: 0 };
      summary[r.account_manager].population++;
      if (r.is_stalled) summary[r.account_manager].stalled++;
    }
    for (const am of Object.keys(summary)) {
      const s = summary[am];
      s.rate = s.population > 0 ? Math.round((s.stalled / s.population) * 100) : 0;
    }

    if (dryRun) {
      return { statusCode: 200, headers, body: JSON.stringify({ dryRun: true, rowCount: rows.length, summary, syncedAt: now.toISOString() }) };
    }

    // Replace the table contents atomically-ish: delete all, then bulk insert.
    // (Small table; last-write-wins is fine for a periodic snapshot.)
    const delRes = await fetch(`${SUPABASE_URL}/rest/v1/stall_clients?deal_id=gt.0`, { method: 'DELETE', headers: { ...supaAuth } });
    if (!delRes.ok && delRes.status !== 404) {
      const t = await delRes.text();
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'delete failed', detail: t.slice(0, 300) }) };
    }
    // Insert in chunks of 200 to stay within payload limits.
    const stamped = rows.map(r => ({ ...r, synced_at: now.toISOString() }));
    for (let i = 0; i < stamped.length; i += 200) {
      const chunk = stamped.slice(i, i + 200);
      const insRes = await fetch(`${SUPABASE_URL}/rest/v1/stall_clients`, {
        method: 'POST',
        headers: { ...supaAuth, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(chunk),
      });
      if (!insRes.ok) {
        const t = await insRes.text();
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'insert failed', at: i, detail: t.slice(0, 300) }) };
      }
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, rowCount: rows.length, summary, syncedAt: now.toISOString() }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message, cause: String(err.cause || '') }) };
  }
};
