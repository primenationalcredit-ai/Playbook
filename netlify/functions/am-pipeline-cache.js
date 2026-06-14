// am-pipeline-cache.js  (CRS/Sold/Incomplete clients, resumable + time-bounded)
// Scans OPEN deals in the relevant client pipelines and computes per-AM stall
// stats. This is the correct universe for the AM bonus: active clients only,
// not the full 60k+ person list of old leads.
//
// Pipelines (from Joe): 45 = CRS, 7 = Sold, 71 = Incomplete.
// Clients are de-duplicated by person_id so a client with more than one deal is
// only counted once. AM and stall status are read off the deal (the Account
// Manager person-field is exposed on deals in this account, same as the live AM
// metrics use it).
//
// Each run scans for ~8s from the saved cursor and returns cleanly; the next run
// (manual or the every-2-hours schedule) resumes. Because the active-client set
// is small, this normally finishes in a single run -> fully automatic.
//
// Writes: app_cache[am_pipeline_full] (read by am-stall-rate),
//         app_cache[am_person_to_am] (person_id -> AM, for rounds/referrals).
// Progress: app_cache[am_pipeline_progress_v2].

const PIPEDRIVE_TOKEN = process.env.PIPEDRIVE_API_KEY || '328f4866f7d86c2bfbee1ed8b5c1895a1f6444d0';
const PIPEDRIVE_DOMAIN = process.env.PIPEDRIVE_DOMAIN || 'asapcreditrepairusa';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ACCOUNT_MANAGER_FIELD = '0a2bceaec010dd949056d374970917a6b573f1dc';
const UPDATE_STATUS_FIELD = '6381d902f9c164217fbb0b5a6b98f10f1bce7fad';

// Relevant client pipelines
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
const PROGRESS_KEY = 'am_pipeline_progress_v2';
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

async function publish(personData, dealsScanned, complete) {
  const amStats = {};
  const personToAM = {};
  const pipelineCounts = { CRS: 0, Sold: 0, Incomplete: 0 };
  for (const [id, d] of Object.entries(personData)) {
    personToAM[id] = d.am;
    if (pipelineCounts[d.pipeline] !== undefined) pipelineCounts[d.pipeline]++;
    if (!amStats[d.am]) amStats[d.am] = { total: 0, reportStalled: 0, paymentStalled: 0, stalledClients: [] };
    const s = amStats[d.am];
    s.total++;
    const statusId = d.statusId;
    const label = STATUS_LABELS[statusId] || `ID:${statusId}`;
    if (REPORT_STALLED.includes(statusId)) { s.reportStalled++; s.stalledClients.push({ name: d.name, id, updateStatus: label, type: 'report' }); }
    if (PAYMENT_STALLED.includes(statusId)) { s.paymentStalled++; s.stalledClients.push({ name: d.name, id, updateStatus: label, type: 'payment' }); }
    if (statusId === 1857) { s.reportStalled++; s.paymentStalled++; s.stalledClients.push({ name: d.name, id, updateStatus: label, type: 'both' }); }
  }
  const results = {};
  for (const [am, s] of Object.entries(amStats)) {
    results[am] = {
      totalClients: s.total,
      reportStalled: s.reportStalled,
      paymentStalled: s.paymentStalled,
      reportStallRate: s.total > 0 ? Math.round((s.reportStalled / s.total) * 100) : 0,
      paymentStallRate: s.total > 0 ? Math.round((s.paymentStalled / s.total) * 100) : 0,
      combinedStallRate: s.total > 0 ? Math.round(((s.reportStalled + s.paymentStalled) / s.total) * 100) : 0,
      stalledClients: s.stalledClients.slice(0, 50)
    };
  }
  const calculatedAt = new Date().toISOString();
  await writeCache('am_pipeline_full', {
    accountManagers: results,
    totalPersonsScanned: Object.keys(personData).length,
    dealsScanned,
    pipelineCounts,
    complete,
    stallThresholdDays: 14,
    calculatedAt
  });
  await writeCache('am_person_to_am', { personToAM, calculatedAt });
  return { managers: Object.keys(results).length, totalClients: Object.keys(personData).length, pipelineCounts };
}

exports.handler = async (event) => {
  if (event && event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  const t0 = Date.now();
  try {
    const params = (event && event.queryStringParameters) || {};

    let progress = await readCache(PROGRESS_KEY);
    const freshStart = params.reset === '1' || !progress || progress.complete;
    let personData = freshStart ? {} : (progress.personData || {});
    let nextStart = freshStart ? 0 : (progress.nextStart || 0);
    let dealsScanned = freshStart ? 0 : (progress.dealsScanned || 0);
    let noAm = freshStart ? 0 : (progress.noAm || 0);

    let hasMore = true;
    let pagesThisRun = 0;
    while (hasMore && (Date.now() - t0) < TIME_BUDGET_MS) {
      const res = await pdGet(`/deals?status=open&start=${nextStart}&limit=500`);
      const deals = res.data || [];
      for (const d of deals) {
        dealsScanned++;
        if (!PIPELINE_IDS.has(Number(d.pipeline_id))) continue;
        const pid = d.person_id?.value || d.person_id || null;
        if (!pid) continue;
        const am = amNameOf(d[ACCOUNT_MANAGER_FIELD]);
        if (!am || am === 'null') { noAm++; continue; }
        const name = d.person_id?.name || d.person_name || d.title || `Person ${pid}`;
        personData[pid] = { am, statusId: statusIdOf(d[UPDATE_STATUS_FIELD]), name, pipeline: PIPELINES[Number(d.pipeline_id)] };
      }
      hasMore = res.additional_data?.pagination?.more_items_in_collection || false;
      nextStart = res.additional_data?.pagination?.next_start || (nextStart + 500);
      pagesThisRun++;
      if (deals.length === 0) { hasMore = false; break; }
    }

    const complete = !hasMore;
    const summary = await publish(personData, dealsScanned, complete);
    await writeCache(PROGRESS_KEY, { personData, nextStart, dealsScanned, noAm, complete });

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        ok: true, complete, pagesThisRun, dealsScanned, nextStart: complete ? 0 : nextStart,
        managers: summary.managers, totalClients: summary.totalClients,
        pipelineCounts: summary.pipelineCounts, clientsWithoutAM: noAm,
        note: complete ? 'Full pass complete.' : 'Partial pass saved; will continue on next run / schedule.'
      })
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
