// am-pipeline-cache.js  (rate-safe, resumable; optional People-filter fast path)
//
// AM bonus universe = clients with an OPEN deal in CRS (45), Sold (7) or
// Incomplete (71). Account Manager + UPDATE STATUS are PERSON fields, read from
// person records (they are NOT on deal records).
//
// TWO MODES:
//  A) FAST (preferred): set env PD_ACTIVE_PERSONS_FILTER to a Pipedrive *People*
//     filter id that returns active clients. The function pages that filter
//     (~17 pages for ~8k clients), enriches inline, and finishes a full refresh
//     in one short pass -> good for a near-live dashboard on a frequent schedule.
//  B) FALLBACK (no filter set): phase 1 pages OPEN deals to collect active
//     person_ids; phase 2 pages the People list (500 at a time) and keeps the
//     ones that are active. Accurate and rate-safe, just more pages.
//
// Reads people in pages of 500 (one request each) instead of thousands of single
// lookups, so it never trips Pipedrive's rate limit. Resumable + time-bounded;
// writes progress every 20 pages so a cut-short run never loses work.
//
// Writes app_cache[am_pipeline_full] (read by am-stall-rate) and
// app_cache[am_person_to_am] (person_id -> AM). Progress: am_pipeline_progress_v4.

const PIPEDRIVE_TOKEN = process.env.PIPEDRIVE_API_KEY || '328f4866f7d86c2bfbee1ed8b5c1895a1f6444d0';
const PIPEDRIVE_DOMAIN = process.env.PIPEDRIVE_DOMAIN || 'asapcreditrepairusa';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ACTIVE_FILTER = process.env.PD_ACTIVE_PERSONS_FILTER || '';

const ACCOUNT_MANAGER_FIELD = '0a2bceaec010dd949056d374970917a6b573f1dc';
const UPDATE_STATUS_FIELD = '6381d902f9c164217fbb0b5a6b98f10f1bce7fad';

const PIPELINES = { 45: 'CRS', 7: 'Sold', 71: 'Incomplete' };
const PIPELINE_IDS = new Set(Object.keys(PIPELINES).map(Number));

const REPORT_STALLED = [934, 937];
const PAYMENT_STALLED = [1616, 1777, 1861];
const STATUS_LABELS = {
  934: 'LOGINS NOT READY', 937: 'CHECK LOGINS', 1616: 'OWES MONEY (AUTO PILOT)',
  1777: 'RD1 DONE, OWES MONEY', 1857: 'ROUND DONE NEED REPORTS/PAYMENT',
  1861: 'RESULTS SENT WAITING ON $$$'
};

const TIME_BUDGET_MS = 8500;
const CHECKPOINT_EVERY = 20;     // pages
const PROGRESS_KEY = 'am_pipeline_progress_v4';
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
const supaAuth = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

async function pdGet(path) {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1${path}${sep}api_token=${PIPEDRIVE_TOKEN}`);
  return res.ok ? await res.json() : { data: null, _failed: true };
}
function amNameOf(val) { if (!val) return null; if (typeof val === 'string') return val; return val.name || val.value || null; }
function statusIdOf(val) { if (val === null || val === undefined) return 0; if (typeof val === 'object') return Number(val.value ?? val.id) || 0; return Number(val) || 0; }

async function readCache(key) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/app_cache?cache_key=eq.${key}&select=cache_value`, { headers: supaAuth });
    if (res.ok) { const rows = await res.json(); if (rows[0]) return JSON.parse(rows[0].cache_value); }
  } catch (e) {}
  return null;
}
async function writeCache(key, data) {
  await fetch(`${SUPABASE_URL}/rest/v1/app_cache`, {
    method: 'POST',
    headers: { ...supaAuth, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ cache_key: key, cache_value: JSON.stringify(data), updated_at: new Date().toISOString() })
  });
}

function enrich(personData, p, pipelineName) {
  const am = amNameOf(p[ACCOUNT_MANAGER_FIELD]);
  if (!am || am === 'null') return false;
  personData[p.id] = { am, statusId: statusIdOf(p[UPDATE_STATUS_FIELD]), name: p.name, pipeline: pipelineName || 'CRS' };
  return true;
}

async function publish(personData, complete, extra) {
  const amStats = {}; const personToAM = {}; const pipelineCounts = { CRS: 0, Sold: 0, Incomplete: 0 };
  for (const [id, d] of Object.entries(personData)) {
    personToAM[id] = d.am;
    if (pipelineCounts[d.pipeline] !== undefined) pipelineCounts[d.pipeline]++;
    if (!amStats[d.am]) amStats[d.am] = { total: 0, reportStalled: 0, paymentStalled: 0, stalledClients: [] };
    const s = amStats[d.am]; s.total++;
    const statusId = d.statusId; const label = STATUS_LABELS[statusId] || `ID:${statusId}`;
    if (REPORT_STALLED.includes(statusId)) { s.reportStalled++; s.stalledClients.push({ name: d.name, id, updateStatus: label, type: 'report' }); }
    if (PAYMENT_STALLED.includes(statusId)) { s.paymentStalled++; s.stalledClients.push({ name: d.name, id, updateStatus: label, type: 'payment' }); }
    if (statusId === 1857) { s.reportStalled++; s.paymentStalled++; s.stalledClients.push({ name: d.name, id, updateStatus: label, type: 'both' }); }
  }
  const results = {};
  for (const [am, s] of Object.entries(amStats)) {
    results[am] = {
      totalClients: s.total, reportStalled: s.reportStalled, paymentStalled: s.paymentStalled,
      reportStallRate: s.total > 0 ? Math.round((s.reportStalled / s.total) * 100) : 0,
      paymentStallRate: s.total > 0 ? Math.round((s.paymentStalled / s.total) * 100) : 0,
      combinedStallRate: s.total > 0 ? Math.round(((s.reportStalled + s.paymentStalled) / s.total) * 100) : 0,
      stalledClients: s.stalledClients.slice(0, 50)
    };
  }
  const calculatedAt = new Date().toISOString();
  await writeCache('am_pipeline_full', { accountManagers: results, totalPersonsScanned: Object.keys(personData).length, pipelineCounts, complete, stallThresholdDays: 14, calculatedAt, ...extra });
  await writeCache('am_person_to_am', { personToAM, calculatedAt });
  return { managers: Object.keys(results).length, totalClients: Object.keys(personData).length, pipelineCounts };
}

exports.handler = async (event) => {
  if (event && event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  const t0 = Date.now();
  const left = () => (Date.now() - t0) < TIME_BUDGET_MS;
  try {
    const params = (event && event.queryStringParameters) || {};
    let pr = await readCache(PROGRESS_KEY);
    const fresh = params.reset === '1' || !pr || pr.complete || (pr.mode !== (ACTIVE_FILTER ? 'filter' : 'fallback'));
    const mode = ACTIVE_FILTER ? 'filter' : 'fallback';
    let phase = fresh ? (mode === 'filter' ? 'filter' : 'deals') : (pr.phase || 'deals');
    let activeIds = fresh ? {} : (pr.activeIds || {});
    let cursor = fresh ? 0 : (pr.cursor || 0);
    let personData = fresh ? {} : (pr.personData || {});
    let pagesThisRun = 0;

    // FAST MODE: page the active-clients People filter and enrich inline
    if (phase === 'filter') {
      let hasMore = true;
      while (hasMore && left()) {
        const res = await pdGet(`/persons?filter_id=${ACTIVE_FILTER}&start=${cursor}&limit=500`);
        const persons = res.data || [];
        for (const p of persons) enrich(personData, p, 'CRS');
        hasMore = res.additional_data?.pagination?.more_items_in_collection || false;
        cursor = res.additional_data?.pagination?.next_start || (cursor + 500);
        pagesThisRun++;
        if (persons.length === 0) hasMore = false;
        if (pagesThisRun % CHECKPOINT_EVERY === 0) await writeCache(PROGRESS_KEY, { mode, phase, activeIds, cursor, personData, complete: false });
      }
      if (!hasMore) phase = 'done';
    }

    // FALLBACK PHASE 1: collect active person_ids from open deals
    if (phase === 'deals') {
      let hasMore = true;
      while (hasMore && left()) {
        const res = await pdGet(`/deals?status=open&start=${cursor}&limit=500`);
        const deals = res.data || [];
        for (const d of deals) {
          if (!PIPELINE_IDS.has(Number(d.pipeline_id))) continue;
          const pid = d.person_id?.value || d.person_id || null;
          if (pid) activeIds[pid] = PIPELINES[Number(d.pipeline_id)];
        }
        hasMore = res.additional_data?.pagination?.more_items_in_collection || false;
        cursor = res.additional_data?.pagination?.next_start || (cursor + 500);
        pagesThisRun++;
        if (deals.length === 0) hasMore = false;
        if (pagesThisRun % CHECKPOINT_EVERY === 0) await writeCache(PROGRESS_KEY, { mode, phase, activeIds, cursor, personData, complete: false });
      }
      if (!hasMore) { phase = 'persons'; cursor = 0; }
    }

    // FALLBACK PHASE 2: page the People LIST (500 at a time), keep active ones
    if (phase === 'persons') {
      let hasMore = true;
      while (hasMore && left()) {
        const res = await pdGet(`/persons?start=${cursor}&limit=500`);
        const persons = res.data || [];
        for (const p of persons) {
          const pipe = activeIds[p.id];
          if (pipe) enrich(personData, p, pipe);
        }
        hasMore = res.additional_data?.pagination?.more_items_in_collection || false;
        cursor = res.additional_data?.pagination?.next_start || (cursor + 500);
        pagesThisRun++;
        if (persons.length === 0) hasMore = false;
        if (pagesThisRun % CHECKPOINT_EVERY === 0) await writeCache(PROGRESS_KEY, { mode, phase, activeIds, cursor, personData, complete: false });
      }
      if (!hasMore) phase = 'done';
    }

    const complete = phase === 'done';
    const summary = await publish(personData, complete, { activeClientCount: Object.keys(activeIds).length, mode });
    await writeCache(PROGRESS_KEY, { mode, phase: complete ? 'done' : phase, activeIds, cursor, personData, complete });

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        ok: true, complete, mode, phase, pagesThisRun,
        activeClients: mode === 'filter' ? Object.keys(personData).length : Object.keys(activeIds).length,
        enriched: Object.keys(personData).length, managers: summary.managers, pipelineCounts: summary.pipelineCounts,
        note: complete ? 'Full pass complete.' : 'Partial pass saved; run again.'
      })
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
