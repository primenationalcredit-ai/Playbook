// AM Stall Rate Calculator with Supabase caching
const PIPEDRIVE_TOKEN = process.env.PIPEDRIVE_API_KEY || '328f4866f7d86c2bfbee1ed8b5c1895a1f6444d0';
const PIPEDRIVE_DOMAIN = process.env.PIPEDRIVE_DOMAIN || 'asapcreditrepairusa';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ACCOUNT_MANAGER_FIELD = '0a2bceaec010dd949056d374970917a6b573f1dc';
const UPDATE_STATUS_FIELD = '6381d902f9c164217fbb0b5a6b98f10f1bce7fad';

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };

async function pdGet(path) {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1${path}${sep}api_token=${PIPEDRIVE_TOKEN}`);
  return res.ok ? await res.json() : { data: null };
}

async function getCache() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/app_cache?cache_key=eq.am_stall_rate&select=*`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    if (res.ok) {
      const rows = await res.json();
      if (rows.length > 0) return JSON.parse(rows[0].cache_value);
    }
  } catch(e) {}
  return null;
}

async function setCache(data) {
  try {
    // Upsert cache
    await fetch(`${SUPABASE_URL}/rest/v1/app_cache`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ cache_key: 'am_stall_rate', cache_value: JSON.stringify(data), updated_at: new Date().toISOString() })
    });
  } catch(e) {}
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  try {
    const params = event.queryStringParameters || {};

    // Prefer the full-coverage scan written by the scheduled am-pipeline-cache
    // function. It scans ALL persons off the round dates, so it is the authoritative
    // source. The job only runs midday to evening, so keep using the last complete
    // pass for up to 48 hours. A stale-but-correct round snapshot always beats the
    // crude person-level fallback, which has no round window and dilutes the rate.
    if (!params.refresh) {
      try {
        const fullRes = await fetch(`${SUPABASE_URL}/rest/v1/app_cache?cache_key=eq.am_pipeline_full&select=*`, {
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
        });
        if (fullRes.ok) {
          const rows = await fullRes.json();
          if (rows.length > 0) {
            const full = JSON.parse(rows[0].cache_value);
            const age = Date.now() - new Date(full.calculatedAt).getTime();
            if (full.accountManagers && age < 48 * 3600000) { // 48 hours
              return { statusCode: 200, headers, body: JSON.stringify({ ...full, fromCache: true, source: 'full_scan' }) };
            }
          }
        }
      } catch (e) {}
    }

    // Fall back to the on-demand limited cache (< 1 hour old)
    if (!params.refresh) {
      const cached = await getCache();
      if (cached && cached.calculatedAt) {
        const age = Date.now() - new Date(cached.calculatedAt).getTime();
        if (age < 3600000) { // 1 hour
          return { statusCode: 200, headers, body: JSON.stringify({ ...cached, fromCache: true }) };
        }
      }
    }

    const today = new Date();
    const stallThresholdDays = 14;
    
    let allPersons = [];
    let start = 0;
    let hasMore = true;
    const maxPages = 10;
    let pageCount = 0;
    
    // Get AM names dynamically from Playbook users table
    let TARGET_AMS = [];
    try {
      const amRes = await fetch(`${SUPABASE_URL}/rest/v1/users?department=eq.account_managers&select=name`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      });
      if (amRes.ok) {
        const amUsers = await amRes.json();
        // Store all name parts for flexible matching
        TARGET_AMS = amUsers.flatMap(u => u.name.toLowerCase().split(/[\s-]+/).filter(p => p.length > 2));
      }
    } catch(e) {}
    // Fallback if no AMs found in users table
    if (TARGET_AMS.length === 0) TARGET_AMS = ['dex-ann', 'zairen', 'raquel'];
    
    while (hasMore && pageCount < maxPages) {
      const res = await pdGet(`/persons?start=${start}&limit=500`);
      const persons = res.data || [];
      for (const p of persons) {
        const amVal = p[ACCOUNT_MANAGER_FIELD];
        if (!amVal) continue;
        const amName = typeof amVal === 'string' ? amVal : (amVal?.name || amVal?.value || String(amVal));
        // Only keep if AM matches one of the 3 targets
        if (TARGET_AMS.some(t => amName.toLowerCase().includes(t))) {
          allPersons.push(p);
        }
      }
      hasMore = res.additional_data?.pagination?.more_items_in_collection || false;
      start = (res.additional_data?.pagination?.next_start) || (start + 500);
      pageCount++;
      if (persons.length === 0) break;
    }

    const amStats = {};
    const REPORT_STALLED = [934, 937];
    const PAYMENT_STALLED = [1616, 1777, 1861];
    const STATUS_LABELS = {
      934: 'LOGINS NOT READY', 937: 'CHECK LOGINS', 1616: 'OWES MONEY (AUTO PILOT)',
      1777: 'RD1 DONE, OWES MONEY', 1857: 'ROUND DONE NEED REPORTS/PAYMENT',
      1861: 'RESULTS SENT WAITING ON $$$'
    };
    
    for (const person of allPersons) {
      const amValue = person[ACCOUNT_MANAGER_FIELD];
      if (!amValue) continue;
      const amName = typeof amValue === 'string' ? amValue : (amValue?.name || amValue?.value || String(amValue));
      if (!amName || amName === 'null') continue;
      if (!amStats[amName]) amStats[amName] = { total: 0, reportStalled: 0, paymentStalled: 0, stalledClients: [] };
      amStats[amName].total++;

      const statusRaw = person[UPDATE_STATUS_FIELD];
      const statusId = Number(statusRaw) || 0;
      
      if (REPORT_STALLED.includes(statusId)) {
        amStats[amName].reportStalled++;
        amStats[amName].stalledClients.push({ name: person.name, id: person.id, updateStatus: STATUS_LABELS[statusId] || `ID:${statusId}`, type: 'report' });
      }
      if (PAYMENT_STALLED.includes(statusId)) {
        amStats[amName].paymentStalled++;
        amStats[amName].stalledClients.push({ name: person.name, id: person.id, updateStatus: STATUS_LABELS[statusId] || `ID:${statusId}`, type: 'payment' });
      }
      if (statusId === 1857) {
        amStats[amName].reportStalled++;
        amStats[amName].paymentStalled++;
        amStats[amName].stalledClients.push({ name: person.name, id: person.id, updateStatus: STATUS_LABELS[statusId] || `ID:${statusId}`, type: 'both' });
      }
    }

    const results = {};
    for (const [am, stats] of Object.entries(amStats)) {
      results[am] = {
        totalClients: stats.total,
        reportStalled: stats.reportStalled,
        paymentStalled: stats.paymentStalled,
        reportStallRate: stats.total > 0 ? Math.round((stats.reportStalled / stats.total) * 100) : 0,
        paymentStallRate: stats.total > 0 ? Math.round((stats.paymentStalled / stats.total) * 100) : 0,
        combinedStallRate: stats.total > 0 ? Math.round(((stats.reportStalled + stats.paymentStalled) / stats.total) * 100) : 0,
        stalledClients: stats.stalledClients.slice(0, 30)
      };
    }

    const responseData = {
      accountManagers: results,
      totalPersonsScanned: allPersons.length,
      pagesScanned: pageCount,
      stallThresholdDays,
      calculatedAt: new Date().toISOString()
    };

    // Cache results
    await setCache(responseData);

    return { statusCode: 200, headers, body: JSON.stringify(responseData) };
  } catch (err) {
    // On error, try to serve cached data
    const cached = await getCache();
    if (cached) return { statusCode: 200, headers, body: JSON.stringify({ ...cached, fromCache: true, cacheReason: err.message }) };
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
