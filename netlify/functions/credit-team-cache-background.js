// credit-team-cache-background.js
// Background function (15-min budget) that scans the CRS Round-1-started population once and caches
// each deal's round dates (app_cache['credit_team_round_dates']) so credit-team-bonus-metrics can
// compute the Round 3 cohort and 4th-round metrics instantly from the cache.

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

exports.handler = async () => {
  try {
    let start = 0, more = true, pages = 0;
    const out = [];
    while (more && pages < 60) {
      const r = await pdGet(`/deals?filter_id=${ROUND1_STARTED_FILTER}&start=${start}&limit=500`);
      for (const d of (r.data || [])) {
        const a = d[F.rd1] || null;   // RD1 start
        const c = d[F.rd3] || null;   // RD3 start
        const e = d[RD3_END] || null; // RD3 end
        const dd = d[F.rd4] || null;  // RD4 start
        if (a || e || dd) out.push({ id: d.id, n: d.title || null, a, c, e, d: dd });
      }
      more = r.additional_data && r.additional_data.pagination && r.additional_data.pagination.more_items_in_collection;
      start = (r.additional_data && r.additional_data.pagination && r.additional_data.pagination.next_start) || (start + 500);
      pages++;
    }
    await writeCache('credit_team_round_dates', {
      deals: out, kept: out.length, pagesScanned: pages, complete: !more, scannedAt: new Date().toISOString(),
    });
    return { statusCode: 200, body: JSON.stringify({ ok: true, kept: out.length, pages, complete: !more }) };
  } catch (e) {
    return { statusCode: 200, body: JSON.stringify({ ok: false, error: e.message }) };
  }
};
