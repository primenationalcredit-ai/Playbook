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

    const affRes = await fetch(`${SUPABASE_URL}/rest/v1/affiliate_orgs?id=eq.${encodeURIComponent(id)}&select=id,org_name,pipedrive_org_id,contact_name,contact_email,contact_phone,portal_link,pipedrive_add_time,org_created_at,company,occupation,industry,owner_name,segment,referred_deals,sold_clients,last_referral_date,pipedrive_fu_notes,recruited_by_super,super_affiliate`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    const aff = ((await affRes.json()) || [])[0];
    if (!aff || !aff.pipedrive_org_id) return { statusCode: 404, headers, body: JSON.stringify({ error: 'affiliate not found or no pipedrive org' }) };

    // Previous call notes: LIVE from the Pipedrive org's Additional F/U Notes
    // (falls back to the synced copy if Pipedrive is unreachable)
    const PD_FU_NOTES_KEY = '17c6fcd0a8bcc21bbba680a8fe82697d9f996df9';
    let fuNotes = aff.pipedrive_fu_notes || null;
    try {
      const og = await fetch(`https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/organizations/${aff.pipedrive_org_id}?api_token=${PIPEDRIVE_TOKEN}`);
      const od = await og.json();
      const live = od && od.data && od.data[PD_FU_NOTES_KEY];
      if (live) fuNotes = String(live);
    } catch (e) {}

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

    const CS_KEY = '612856f2221d04679c1809eadb77b30300936445'; // CURRENT STATUS field; 1901 = SOLD
    // Sales truth lives in payment records, not on referral deals. Match by deal
    // id or client name, date-guarded: a payment only counts if it happened after
    // the affiliate existed (same rule as the book-sync).
    const normName = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const soldDealIds = new Set();
    const soldNames = new Set();
    try {
      const born = String(aff.pipedrive_add_time || aff.org_created_at || '').slice(0, 10) || null;
      const pRes = await fetch(`${SUPABASE_URL}/rest/v1/consultant_payments?referrer_org=ilike.${encodeURIComponent(aff.org_name)}&select=pipedrive_deal_id,client_name,payment_date`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      });
      const pays = pRes.ok ? await pRes.json() : [];
      for (const p of (Array.isArray(pays) ? pays : [])) {
        const d = String(p.payment_date || '').slice(0, 10);
        if (born && d && d < born) continue;
        if (p.pipedrive_deal_id) soldDealIds.add(String(p.pipedrive_deal_id));
        if (p.client_name) soldNames.add(normName(p.client_name));
      }
    } catch (e) {}
    const list = deals.map((d) => ({
      deal_id: d.id,
      sold: d.status === 'won' || String(d[CS_KEY] ?? '') === '1901' || soldDealIds.has(String(d.id)) || soldNames.has(normName((d.person_id && d.person_id.name) || d.person_name || '')),
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

    const sold = list.filter((x) => x.sold);
    const stats = {
      total_referred: list.length,
      total_sold: sold.length,
      open_now: list.filter((x) => x.status === 'open').length,
      last_referral: list.length ? list[0].added : null,
      last_sale: sold.length ? sold.map((x) => x.won || x.added).sort().reverse()[0] : null
    };

    return { statusCode: 200, headers, body: JSON.stringify({ org: aff.org_name, pipedrive_org_id: aff.pipedrive_org_id, contact: { name: aff.contact_name || null, email: aff.contact_email || null, phone: aff.contact_phone || null, portal_link: aff.portal_link || null }, profile: { company: aff.company || null, occupation: aff.occupation || null, industry: aff.industry || null, owner: aff.owner_name || null, segment: aff.segment || null, recruited_by_super: aff.recruited_by_super || null, is_super: !!aff.super_affiliate }, fu_notes: fuNotes, stats, deals: list }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: String((e && e.message) || e) }) };
  }
};
