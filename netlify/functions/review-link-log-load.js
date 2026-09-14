// review-link-log-load.js (Playbook)
// FIX (Joe 9/14, "not showing on the log" ticket - the write side was already
// fixed 9/8, this is the separate read side): confirmed directly - the anon key
// the page's shared supabaseFetch helper uses gets zero rows and no error from
// review_link_log, while the service role key sees all of them, including a real
// send from today. Same RLS-blocks-anon-SELECT pattern as the daily checklist
// bug found the same night. Routes this one table's read through the service
// role key instead, without touching supabaseFetch itself (which works fine for
// every other table that does have a real anon SELECT policy).
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://kkcbpqbcpzcarxhknzza.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (!SUPABASE_KEY) return { statusCode: 500, headers, body: JSON.stringify({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' }) };

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/review_link_log?select=*&order=sent_at.desc&limit=1000`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'Supabase read failed', status: r.status, detail: text }) };
    }
    const rows = await r.json();
    return { statusCode: 200, headers, body: JSON.stringify(rows) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: String((e && e.message) || e) }) };
  }
};
