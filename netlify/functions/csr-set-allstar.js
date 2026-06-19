// Sets or clears the All-Star CSR award (manual, +$100, one winner per month).
// POST { month: "YYYY-MM", csr: "Name", action: "set" | "clear" }
// Stored in bonus_awards as bonus_type = 'all_star_csr'.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

  try {
    const { month, csr, action } = JSON.parse(event.body || '{}');
    if (!month || !/^\d{4}-\d{2}$/.test(month)) return { statusCode: 400, headers, body: JSON.stringify({ error: 'valid month (YYYY-MM) required' }) };

    const base = `${SUPABASE_URL}/rest/v1/bonus_awards`;
    const auth = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };

    // Always clear the existing winner for the month first (only one winner per month)
    await fetch(`${base}?bonus_type=eq.all_star_csr&awarded_month=eq.${month}`, { method: 'DELETE', headers: auth });

    if (action === 'set') {
      if (!csr) return { statusCode: 400, headers, body: JSON.stringify({ error: 'csr required to set' }) };
      const res = await fetch(base, {
        method: 'POST',
        headers: { ...auth, Prefer: 'return=minimal' },
        body: JSON.stringify({ bonus_type: 'all_star_csr', consultant_name: csr, org_name: null, amount: 100, awarded_month: month })
      });
      if (!res.ok) return { statusCode: 500, headers, body: JSON.stringify({ error: await res.text() }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, month, csr: action === 'set' ? csr : null }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
