// org-owner-map-refresh.js (Joe 9/1): the bonus page needs to know which consultant
// owns each referral organization (label 2993) so the reactivation kicker credits the
// owner rather than whoever covered a payment. Paging Pipedrive's organizations inside
// the bonus function pushed it past its time limit and 502'd on a cold cache. This
// builds the map on its own schedule and writes it to app_cache; the bonus function
// only ever reads it.
const SB = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SK = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PDT = process.env.PIPEDRIVE_API_KEY || process.env.PIPEDRIVE_API_TOKEN;
exports.handler = async (event) => {
  const q = (event && event.queryStringParameters) || {};
  const scheduled = !event || !event.headers || !event.httpMethod;
  if (!scheduled) {
    const k = (event.headers && (event.headers['x-api-key'] || event.headers['X-API-Key'])) || q.key || '';
    if (k !== process.env.INTERNAL_API_KEY) return { statusCode: 401, body: '{"error":"unauthorized"}' };
  }
  const map = {};
  let scanned = 0, pages = 0;
  try {
    let s = 0, more = true;
    while (more && s < 40000) {
      const r = await fetch('https://asapcreditrepairusa.pipedrive.com/api/v1/organizations?start=' + s + '&limit=500&api_token=' + PDT).then(x => x.json()).catch(() => null);
      const d = (r && r.data) || [];
      scanned += d.length; pages++;
      for (const o of d) { if (o.label === 2993 && o.owner_id && o.owner_id.name && o.owner_id.name !== 'Zapier') map[o.name] = o.owner_id.name; }
      more = !!(r && r.additional_data && r.additional_data.pagination && r.additional_data.pagination.more_items_in_collection);
      s += 500;
    }
    await fetch(SB + '/rest/v1/app_cache?on_conflict=cache_key', { method: 'POST', headers: { apikey: SK, Authorization: 'Bearer ' + SK, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ cache_key: 'org_owner_map', cache_value: JSON.stringify(map), updated_at: new Date().toISOString() }) });
  } catch (e) {
    return { statusCode: 200, body: JSON.stringify({ error: String(e.message).slice(0, 150), owned: Object.keys(map).length }) };
  }
  return { statusCode: 200, body: JSON.stringify({ scanned, pages, owned: Object.keys(map).length }) };
};
