// daily-checklist-load.js (Playbook)
// Companion to daily-checklist-save.js's fix (Joe 9/14): the anon key can't just
// write, it can't READ this table's rows either - confirmed directly, a row
// written via the service key is fully invisible to the anon key's SELECT (0 vs 1
// row for the identical query). The load side needs the same service-role
// treatment as the save side, or a fixed save alone would still show an empty
// checklist on every reload.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://kkcbpqbcpzcarxhknzza.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (!SUPABASE_KEY) return { statusCode: 500, headers, body: JSON.stringify({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' }) };

  const qs = event.queryStringParameters || {};
  const userKey = qs.user_key;
  const day = qs.day;
  if (!userKey || !day) return { statusCode: 400, headers, body: JSON.stringify({ error: 'user_key and day are required' }) };

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/role_daily_checklist?user_key=eq.${encodeURIComponent(userKey)}&day=eq.${encodeURIComponent(day)}&select=checked`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'Supabase read failed', status: r.status, detail: text }) };
    }
    const rows = await r.json();
    return { statusCode: 200, headers, body: JSON.stringify({ checked: (rows[0] && rows[0].checked) || {} }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: String((e && e.message) || e) }) };
  }
};
