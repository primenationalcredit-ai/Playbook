// credit-team-cache-background.js
// Background function (15-min budget) that scans the CRS Round-1-started population once and:
//   1. caches each deal's round dates (app_cache['credit_team_round_dates']) for the cohort metric, and
//   2. stamps when a deal first reaches "3RD RD RESULTS SENT" (Current Status 719) into the
//      credit_team_status table, keeping each deal's RD4-started flag fresh, for the 4th-round metric.
// Stamps persist across runs (first-seen date is preserved), so the data builds accuracy over time.

const PIPEDRIVE_API_KEY = process.env.PIPEDRIVE_API_KEY || '328f4866f7d86c2bfbee1ed8b5c1895a1f6444d0';
const PIPEDRIVE_DOMAIN = process.env.PIPEDRIVE_DOMAIN || 'asapcreditrepairusa';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ROUND1_STARTED_FILTER = 523849; // CRS deals where RD 1 Start/End is set
const F = {
  rd1: '6979c70df67f42c28dfcff39284ae17d564d600f',
  rd3: '8d681007c089ee4c7390c02ee2f027ca60374708',
  rd4: '1d1bc8fbf1b8982640ef70131f010908788a7bd0',
};
const RD3_END = '8d681007c089ee4c7390c02ee2f027ca60374708_until';
const CURRENT_STATUS = '612856f2221d04679c1809eadb77b30300936445'; // Current Status (enum)
const R3_RESULTS_SENT = 719; // option: "3RD RD RESULTS SENT"

const supaAuth = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

async function pdGet(path) {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1${path}${sep}api_token=${PIPEDRIVE_API_KEY}`);
  if (!res.ok) throw new Error(`Pipedrive ${res.status}`);
  return res.json();
}
async function writeCache(key, data) {
  await fetch(`${SUPABASE_URL}/rest/v1/app_cache`, {
    method: 'POST',
    headers: { ...supaAuth, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ cache_key: key, cache_value: JSON.stringify(data), updated_at: new Date().toISOString() }),
  });
}
async function supaGet(pathQuery) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathQuery}`, { headers: supaAuth });
  if (!res.ok) return [];
  return res.json();
}

exports.handler = async () => {
  try {
    let start = 0, more = true, pages = 0;
    const out = [];
    const seen = []; // { id, atResultsSent, rd4 } for every scanned deal

    while (more && pages < 60) {
      const r = await pdGet(`/deals?filter_id=${ROUND1_STARTED_FILTER}&start=${start}&limit=500`);
      for (const d of (r.data || [])) {
        const a = d[F.rd1] || null;   // RD1 start
        const c = d[F.rd3] || null;   // RD3 start
        const e = d[RD3_END] || null; // RD3 end
        const dd = d[F.rd4] || null;  // RD4 start
        if (a || e || dd) out.push({ a, c, e, d: dd });
        seen.push({ id: String(d.id), atResultsSent: Number(d[CURRENT_STATUS]) === R3_RESULTS_SENT, rd4: !!dd });
      }
      more = r.additional_data && r.additional_data.pagination && r.additional_data.pagination.more_items_in_collection;
      start = (r.additional_data && r.additional_data.pagination && r.additional_data.pagination.next_start) || (start + 500);
      pages++;
    }

    await writeCache('credit_team_round_dates', {
      deals: out, kept: out.length, pagesScanned: pages, complete: !more, scannedAt: new Date().toISOString(),
    });

    // --- Stamp "3rd round results sent" + keep RD4 flag fresh ---
    const existing = await supaGet('credit_team_status?select=deal_id,r3_results_sent_at');
    const stampMap = {};
    for (const row of existing) stampMap[row.deal_id] = row.r3_results_sent_at;
    const nowIso = new Date().toISOString();
    const batch = [];
    let newStamps = 0;
    for (const s of seen) {
      const had = Object.prototype.hasOwnProperty.call(stampMap, s.id);
      if (!s.atResultsSent && !had) continue; // not at results-sent and never was -> ignore
      let sentAt = stampMap[s.id] || null;
      if (!sentAt && s.atResultsSent) { sentAt = nowIso; newStamps++; } // first time seen at 719
      batch.push({ deal_id: s.id, r3_results_sent_at: sentAt, rd4_started: s.rd4, updated_at: nowIso });
    }
    // upsert in chunks
    let stamped = 0;
    for (let i = 0; i < batch.length; i += 500) {
      const chunk = batch.slice(i, i + 500);
      const res = await fetch(`${SUPABASE_URL}/rest/v1/credit_team_status`, {
        method: 'POST',
        headers: { ...supaAuth, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(chunk),
      });
      if (res.ok) stamped += chunk.length;
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, kept: out.length, pages, complete: !more, statusRows: batch.length, newStamps, stamped }) };
  } catch (e) {
    return { statusCode: 200, body: JSON.stringify({ ok: false, error: e.message }) };
  }
};
