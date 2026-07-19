// Affiliate outreach activity feed: recent affiliate_touches joined with org
// names, plus today / last-7-day counts by channel. Read-only, admin dashboard.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  try {
    const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
    const limit = Math.min(parseInt((event.queryStringParameters || {}).limit) || 200, 500);
    const tRes = await fetch(`${SUPABASE_URL}/rest/v1/affiliate_touches?select=*&order=created_at.desc&limit=${limit}`, { headers: H });
    const touches = tRes.ok ? await tRes.json() : [];
    const orgIds = [...new Set(touches.map(t => t.affiliate_org_id).filter(Boolean))];
    const orgById = {};
    for (let i = 0; i < orgIds.length; i += 100) {
      const chunk = orgIds.slice(i, i + 100);
      const oRes = await fetch(`${SUPABASE_URL}/rest/v1/affiliate_orgs?id=in.(${chunk.join(',')})&select=id,org_name,contact_name,owner_name`, { headers: H });
      if (oRes.ok) for (const o of await oRes.json()) orgById[o.id] = o;
    }
    const rows = touches.map(t => ({
      ...t,
      org_name: orgById[t.affiliate_org_id]?.org_name || `Org ${t.affiliate_org_id}`,
      contact_name: orgById[t.affiliate_org_id]?.contact_name || null,
      owner_name: orgById[t.affiliate_org_id]?.owner_name || null
    }));
    const dayCT = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
    const weekAgoIso = new Date(Date.now() - 7 * 86400000).toISOString();
    const count = (fn) => rows.filter(fn).length;
    const summary = {
      total_returned: rows.length,
      today: {
        emails: count(r => r.channel === 'email' && dayCT(r.created_at) === today),
        sms: count(r => r.channel === 'sms' && dayCT(r.created_at) === today),
        calls: count(r => r.channel === 'call' && dayCT(r.created_at) === today)
      },
      last7: {
        emails: count(r => r.channel === 'email' && r.created_at >= weekAgoIso),
        sms: count(r => r.channel === 'sms' && r.created_at >= weekAgoIso),
        calls: count(r => r.channel === 'call' && r.created_at >= weekAgoIso)
      }
    };
    return { statusCode: 200, headers, body: JSON.stringify({ summary, rows }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: String(e.message || e) }) };
  }
};
