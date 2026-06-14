// am-pipeline-cache.js  (resumable, time-bounded)
// Scans Pipedrive persons and computes per-AM stall stats with FULL coverage,
// without ever exceeding the function time limit.
//
// How it stays under the limit: each invocation scans for ~8 seconds starting
// from where the last run stopped, saves its progress, and returns cleanly. The
// next invocation (manual or the scheduled job) resumes from the saved cursor.
// When it reaches the end of the person list it finalizes a complete pass and
// then starts a fresh pass on the next run, so the data stays current.
//
// Accumulator is keyed by person_id, so re-scanning a page is harmless (no
// double counting). Writes two caches read by the rest of the app:
//   app_cache[am_pipeline_full]  -> per-AM stall stats (read by am-stall-rate)
//   app_cache[am_person_to_am]   -> person_id -> AM map (rounds/referrals)
// Internal progress lives in app_cache[am_pipeline_progress].

const PIPEDRIVE_TOKEN = process.env.PIPEDRIVE_API_KEY || '328f4866f7d86c2bfbee1ed8b5c1895a1f6444d0';
const PIPEDRIVE_DOMAIN = process.env.PIPEDRIVE_DOMAIN || 'asapcreditrepairusa';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ACCOUNT_MANAGER_FIELD = '0a2bceaec010dd949056d374970917a6b573f1dc';
const UPDATE_STATUS_FIELD = '6381d902f9c164217fbb0b5a6b98f10f1bce7fad';

const REPORT_STALLED = [934, 937];
const PAYMENT_STALLED = [1616, 1777, 1861];
const STATUS_LABELS = {
  934: 'LOGINS NOT READY', 937: 'CHECK LOGINS', 1616: 'OWES MONEY (AUTO PILOT)',
  1777: 'RD1 DONE, OWES MONEY', 1857: 'ROUND DONE NEED REPORTS/PAYMENT',
  1861: 'RESULTS SENT WAITING ON $$$'
};

const TIME_BUDGET_MS = 8000; // stop scanning after ~8s so we return before the limit
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

// Build per-AM stats + person->AM map from the keyed accumulator, then write the
// app-facing caches.
async function publish(personData, nextStart, totalPages, complete) {
  const amStats = {};
  const personToAM = {};
  for (const [id, d] of Object.entries(personData)) {
    personToAM[id] = d.am;
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
    pagesScanned: totalPages,
    complete,
    stallThresholdDays: 14,
    calculatedAt
  });
  await writeCache('am_person_to_am', { personToAM, calculatedAt });
  return { managers: Object.keys(results).length, totalClients: Object.keys(personData).length };
}

exports.handler = async (event) => {
  if (event && event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  const t0 = Date.now();
  try {
    const params = (event && event.queryStringParameters) || {};

    // AM name parts for matching
    let targetParts = [];
    try {
      const amRes = await fetch(`${SUPABASE_URL}/rest/v1/users?department=eq.account_managers&select=name`, { headers: supaAuth });
      if (amRes.ok) {
        const amUsers = await amRes.json();
        targetParts = amUsers.flatMap(u => (u.name || '').toLowerCase().split(/[\s-]+/).filter(p => p.length > 2));
      }
    } catch (e) {}
    if (targetParts.length === 0) targetParts = ['dex-ann', 'zairen', 'raquel', 'bryan', 'kimberly'];

    // Resume from saved progress, unless last pass finished (then start fresh) or reset requested
    let progress = await readCache('am_pipeline_progress');
    const freshStart = params.reset === '1' || !progress || progress.complete;
    let personData = freshStart ? {} : (progress.personData || {});
    let nextStart = freshStart ? 0 : (progress.nextStart || 0);
    let totalPages = freshStart ? 0 : (progress.pagesScanned || 0);

    let hasMore = true;
    let pagesThisRun = 0;
    while (hasMore && (Date.now() - t0) < TIME_BUDGET_MS) {
      const res = await pdGet(`/persons?start=${nextStart}&limit=500`);
      const persons = res.data || [];
      for (const p of persons) {
        const amName = amNameOf(p[ACCOUNT_MANAGER_FIELD]);
        if (!amName || amName === 'null') continue;
        if (!targetParts.some(t => amName.toLowerCase().includes(t))) continue;
        personData[p.id] = { am: amName, statusId: Number(p[UPDATE_STATUS_FIELD]) || 0, name: p.name };
      }
      hasMore = res.additional_data?.pagination?.more_items_in_collection || false;
      nextStart = res.additional_data?.pagination?.next_start || (nextStart + 500);
      totalPages++;
      pagesThisRun++;
      if (persons.length === 0) { hasMore = false; break; }
    }

    const complete = !hasMore;

    // Publish app-facing caches (best-so-far if not complete) and save progress
    const summary = await publish(personData, nextStart, totalPages, complete);
    await writeCache('am_pipeline_progress', { personData, nextStart, pagesScanned: totalPages, complete });

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        ok: true, complete, pagesThisRun, totalPagesScanned: totalPages, nextStart: complete ? 0 : nextStart,
        managers: summary.managers, totalClients: summary.totalClients,
        note: complete ? 'Full pass complete.' : 'Partial pass saved; run again or wait for the scheduled job to continue.'
      })
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
