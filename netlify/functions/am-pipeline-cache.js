// am-pipeline-cache.js  (two-phase: active deals -> person enrichment)
// AM bonus universe = clients with an OPEN deal in CRS (45), Sold (7), or
// Incomplete (71). The Account Manager and stall status are PERSON fields and
// are NOT exposed on deal records, so we:
//   Phase 1 (deals): page open deals, keep those in the 3 pipelines, collect the
//                    person_id + which pipeline. Cheap (person_id is on deals).
//   Phase 2 (persons): enrich each active person via GET /persons/{id} in
//                    parallel batches, reading AM + UPDATE STATUS directly.
// Resumable + time-bounded so no run exceeds the function limit; because the
// active-client set is only a few hundred, it completes quickly and refreshes
// automatically on the 2-hour schedule.
//
// Writes app_cache[am_pipeline_full] (read by am-stall-rate) and
// app_cache[am_person_to_am] (person_id -> AM). Progress: am_pipeline_progress_v3.

const PIPEDRIVE_TOKEN = process.env.PIPEDRIVE_API_KEY || '328f4866f7d86c2bfbee1ed8b5c1895a1f6444d0';
const PIPEDRIVE_DOMAIN = process.env.PIPEDRIVE_DOMAIN || 'asapcreditrepairusa';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

const TIME_BUDGET_MS = 8000;
const PERSON_BATCH = 8;            // parallel person lookups per batch
const PROGRESS_KEY = 'am_pipeline_progress_v3';
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
const supaAuth = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

async function pdGet(path) {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1${path}${sep}api_token=${PIPEDRIVE_TOKEN}`);
  return res.ok ? await res.json() : { data: null };
}

function amNameOf(val) {
  if (!val) return null;
  if (typeof val === 'string') return val;
  return val.name || val.value || null;
}
function statusIdOf(val) {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'object') return Number(val.value ?? val.id) || 0;
  return Number(val) || 0;
}

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

async function publish(personData, complete, extra) {
  const amStats = {};
  const personToAM = {};
  const pipelineCounts = { CRS: 0, Sold: 0, Incomplete: 0 };
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
    const fresh = params.reset === '1' || !pr || pr.complete;
    let phase = fresh ? 'deals' : (pr.phase || 'deals');
    let activeIds = fresh ? {} : (pr.activeIds || {});   // pid -> pipeline name
    let dealCursor = fresh ? 0 : (pr.dealCursor || 0);
    let personIndex = fresh ? 0 : (pr.personIndex || 0);
    let personData = fresh ? {} : (pr.personData || {});
    let noAm = fresh ? 0 : (pr.noAm || 0);
    let dealsScanned = fresh ? 0 : (pr.dealsScanned || 0);

    // PHASE 1: collect active client person_ids from open deals
    if (phase === 'deals') {
      let hasMore = true;
      while (hasMore && left()) {
        const res = await pdGet(`/deals?status=open&start=${dealCursor}&limit=500`);
        const deals = res.data || [];
        for (const d of deals) {
          dealsScanned++;
          if (!PIPELINE_IDS.has(Number(d.pipeline_id))) continue;
          const pid = d.person_id?.value || d.person_id || null;
          if (!pid) continue;
          activeIds[pid] = PIPELINES[Number(d.pipeline_id)];
        }
        hasMore = res.additional_data?.pagination?.more_items_in_collection || false;
        dealCursor = res.additional_data?.pagination?.next_start || (dealCursor + 500);
        if (deals.length === 0) hasMore = false;
      }
      if (!hasMore) { phase = 'persons'; personIndex = 0; }
    }

    // PHASE 2: enrich active persons (AM + stall status) in parallel batches
    if (phase === 'persons') {
      const ids = Object.keys(activeIds);
      while (personIndex < ids.length && left()) {
        const slice = ids.slice(personIndex, personIndex + PERSON_BATCH);
        const resns = await Promise.all(slice.map(id => pdGet(`/persons/${id}`)));
        resns.forEach((r, k) => {
          const pid = slice[k]; const p = r.data;
          if (!p) return;
          const am = amNameOf(p[ACCOUNT_MANAGER_FIELD]);
          if (!am || am === 'null') { noAm++; return; }
          personData[pid] = { am, statusId: statusIdOf(p[UPDATE_STATUS_FIELD]), name: p.name, pipeline: activeIds[pid] };
        });
        personIndex += slice.length;
      }
      if (personIndex >= ids.length) { phase = 'done'; }
    }

    const complete = phase === 'done';
    const summary = await publish(personData, complete, { activeClientCount: Object.keys(activeIds).length, clientsWithoutAM: noAm, dealsScanned });
    await writeCache(PROGRESS_KEY, { phase: complete ? 'done' : phase, activeIds, dealCursor, personIndex, personData, noAm, dealsScanned, complete });

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        ok: true, complete, phase,
        dealsScanned, activeClients: Object.keys(activeIds).length, enriched: Object.keys(personData).length,
        clientsWithoutAM: noAm, managers: summary.managers, pipelineCounts: summary.pipelineCounts,
        note: complete ? 'Full pass complete.' : (phase === 'deals' ? 'Still collecting active clients; run again.' : 'Enriching clients; run again.')
      })
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
