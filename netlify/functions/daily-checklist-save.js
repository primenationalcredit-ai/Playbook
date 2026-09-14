// daily-checklist-save.js (Playbook)
// ROOT CAUSE FIX (Joe 9/14, "check-ins clear every time" ticket - still happening
// after an earlier timing fix): the checklist's save call wrote DIRECTLY from the
// browser using the anon key. role_daily_checklist has zero rows, ever - proven
// directly: the anon key can SELECT from this table (0 rows, no error) but gets a
// flat 401 on INSERT/UPDATE. Every employee's checkbox click has been silently
// failing since this feature launched; there was never anything to load back,
// which is exactly why it looked like it "cleared every time." This routes the
// save through the service role key instead, matching how every other write in
// this codebase works, without touching the table's RLS policy directly.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://kkcbpqbcpzcarxhknzza.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
  if (!SUPABASE_KEY) return { statusCode: 500, headers, body: JSON.stringify({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid JSON body' }) }; }

  const { user_key, role, day, checked } = body;
  if (!user_key || !role || !day || !checked) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'user_key, role, day, checked are all required' }) };
  }

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/role_daily_checklist?on_conflict=user_key,day`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify({ user_key, role, day, checked, updated_at: new Date().toISOString() })
    });
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'Supabase write failed', status: r.status, detail: text }) };
    }
    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: String((e && e.message) || e) }) };
  }
};
