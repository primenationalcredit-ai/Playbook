// affiliate-referred-deals.js (Playbook)
// GET ?id=<affiliate_orgs.id>  ->  live referral history for one affiliate:
//   every Pipedrive deal on their org (client name, stage, open/won/lost, dates, value)
//   plus quick stats (total referred, sold, last referral date, last sale date).
// Read-only; pulled on demand when a consultant expands an affiliate.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PIPEDRIVE_TOKEN = process.env.PIPEDRIVE_API_KEY;
const PIPEDRIVE_DOMAIN = process.env.PIPEDRIVE_DOMAIN || 'asapcreditrepairusa';
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  try {
    const id = (event.queryStringParameters || {}).id;
    if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'missing id' }) };

    const affRes = await fetch(`${SUPABASE_URL}/rest/v1/affiliate_orgs?id=eq.${encodeURIComponent(id)}&select=id,org_name,pipedrive_org_id`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    const aff = ((await affRes.json()) || [])[0];
    if (!aff || !aff.pipedrive_org_id) return { statusCode: 404, headers, body: JSON.stringify({ error: 'affiliate not found or no pipedrive org' }) };

    // All deals on the org, newest first (paged; org referral books are small)
    const deals = [];
    let start = 0;
    for (let page = 0; page < 5; page++) {
      const r = await fetch(`https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/organizations/${aff.pipedrive_org_id}/deals?status=all_not_deleted&start=${start}&limit=100&sort=add_time%20DESC&api_token=${PIPEDRIVE_TOKEN}`);
      const d = await r.json();
      const rows = (d && d.data) || [];
      deals.push(...rows);
      const more = d && d.additional_data && d.additional_data.pagination && d.additional_data.pagination.more_items_in_collection;
      if (!more) break;
      start = d.additional_data.pagination.next_start;
    }

    const list = deals.map((d) => ({
      deal_id: d.id,
      client: (d.person_id && d.person_id.name) || d.person_name || d.title || 'Unknown',
      title: d.title || null,
      status: d.status,                       // open | won | lost
      stage_id: d.stage_id || null,
      value: d.value || 0,
      added: d.add_time ? String(d.add_time).slice(0, 10) : null,
      won: d.won_time ? String(d.won_time).slice(0, 10) : null,
      lost: d.lost_time ? String(d.lost_time).slice(0, 10) : null,
      lost_reason: d.lost_reason || null
    }));

    const sold = list.filter((x) => x.status === 'won');
    const stats = {
      total_referred: list.length,
      total_sold: sold.length,
      open_now: list.filter((x) => x.status === 'open').length,
      last_referral: list.length ? list[0].added : null,
      last_sale: sold.length ? sold.map((x) => x.won).sort().reverse()[0] : null
    };

    return { statusCode: 200, headers, body: JSON.stringify({ org: aff.org_name, pipedrive_org_id: aff.pipedrive_org_id, stats, deals: list }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: String((e && e.message) || e) }) };
  }
};
