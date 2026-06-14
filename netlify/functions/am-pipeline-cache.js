// am-pipeline-cache.js  (SCHEDULED, full coverage)
// Paginates through ALL Pipedrive persons (not just the first 5,000), computes
// complete stall-rate stats per Account Manager, and builds a person_id -> AM
// map used by am-additional-rounds and am-referrals for attribution.
// Writes app_cache key "am_pipeline_full". Scheduled functions get a long
// runtime, so this is where the heavy scan belongs. The on-demand
// am-stall-rate function just reads this cache.

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

async function writeCache(key, data) {
  await fetch(`${SUPABASE_URL}/rest/v1/app_cache`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ cache_key: key, cache_value: JSON.stringify(data), updated_at: new Date().toISOString() })
  });
}

exports.handler = async () => {
  const headers = { 'Content-Type': 'application/json' };
  try {
    // Account managers from users table for name matching
    let targetParts = [];
    try {
      const amRes = await fetch(`${SUPABASE_URL}/rest/v1/users?department=eq.account_managers&select=name`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      });
      if (amRes.ok) {
        const amUsers = await amRes.json();
        targetParts = amUsers.flatMap(u => (u.name || '').toLowerCase().split(/[\s-]+/).filter(p => p.length > 2));
      }
    } catch (e) {}
    if (targetParts.length === 0) targetParts = ['dex-ann', 'zairen', 'raquel', 'bryan', 'kimberly'];

    const amStats = {};
    const personToAM = {};
    let start = 0;
    let hasMore = true;
    let pageCount = 0;
    const maxPages = 300; // 300 * 500 = 150,000 persons ceiling

    // Helper: build results + write both cache keys with the current accumulator.
    // Called at checkpoints so a run cut short by a timeout still persists what
    // it scanned, and the next run (or the scheduled background run) completes it.
    const flush = async (complete) => {
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
      const payload = {
        accountManagers: results,
        totalPersonsScanned: Object.values(amStats).reduce((a, s) => a + s.total, 0),
        pagesScanned: pageCount,
        complete,
        stallThresholdDays: 14,
        calculatedAt: new Date().toISOString()
      };
      await writeCache('am_pipeline_full', payload);
      await writeCache('am_person_to_am', { personToAM, calculatedAt: payload.calculatedAt });
      return payload;
    };

    while (hasMore && pageCount < maxPages) {
      const res = await pdGet(`/persons?start=${start}&limit=500`);
      const persons = res.data || [];
      for (const p of persons) {
        const amName = amNameOf(p[ACCOUNT_MANAGER_FIELD]);
        if (!amName || amName === 'null') continue;
        if (!targetParts.some(t => amName.toLowerCase().includes(t))) continue;

        personToAM[p.id] = amName;
        if (!amStats[amName]) amStats[amName] = { total: 0, reportStalled: 0, paymentStalled: 0, stalledClients: [] };
        amStats[amName].total++;

        const statusId = Number(p[UPDATE_STATUS_FIELD]) || 0;
        if (REPORT_STALLED.includes(statusId)) {
          amStats[amName].reportStalled++;
          amStats[amName].stalledClients.push({ name: p.name, id: p.id, updateStatus: STATUS_LABELS[statusId] || `ID:${statusId}`, type: 'report' });
        }
        if (PAYMENT_STALLED.includes(statusId)) {
          amStats[amName].paymentStalled++;
          amStats[amName].stalledClients.push({ name: p.name, id: p.id, updateStatus: STATUS_LABELS[statusId] || `ID:${statusId}`, type: 'payment' });
        }
        if (statusId === 1857) {
          amStats[amName].reportStalled++;
          amStats[amName].paymentStalled++;
          amStats[amName].stalledClients.push({ name: p.name, id: p.id, updateStatus: STATUS_LABELS[statusId] || `ID:${statusId}`, type: 'both' });
        }
      }
      hasMore = res.additional_data?.pagination?.more_items_in_collection || false;
      start = res.additional_data?.pagination?.next_start || (start + 500);
      pageCount++;
      if (persons.length === 0) break;
      // Checkpoint every 20 pages so partial coverage is never lost
      if (pageCount % 20 === 0) await flush(false);
    }

    const payload = await flush(!hasMore);

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, pagesScanned: pageCount, complete: payload.complete, managers: Object.keys(payload.accountManagers).length, totalClients: payload.totalPersonsScanned }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
