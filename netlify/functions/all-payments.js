// All Payments: list + manual add for consultant_payments (service-role, bypasses RLS)
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  try {
    if (event.httpMethod === 'GET') {
      const month = (event.queryStringParameters || {}).month || 'all';
      const filter = month && month !== 'all' ? `payment_month=eq.${month}&` : '';
      const res = await fetch(`${SUPABASE_URL}/rest/v1/consultant_payments?${filter}order=payment_date.desc&select=*`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Range: '0-9999' },
      });
      const data = await res.json();
      return { statusCode: 200, headers, body: JSON.stringify({ payments: Array.isArray(data) ? data : [] }) };
    }

    if (event.httpMethod === 'POST') {
      const b = JSON.parse(event.body || '{}');
      if (!b.client_name || !b.amount || !b.payment_date) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'client_name, amount, and payment_date are required' }) };
      }
      const row = {
        client_name: String(b.client_name).trim(),
        amount: parseFloat(b.amount),
        payment_type: b.payment_type || 'doc_fee',
        payment_date: b.payment_date,
        payment_month: String(b.payment_date).slice(0, 7),
        consultant_name: b.consultant_name ? String(b.consultant_name).trim() : null,
        pipedrive_deal_id: b.pipedrive_deal_id ? String(b.pipedrive_deal_id).trim() : null,
        source: 'manual',
      };
      const res = await fetch(`${SUPABASE_URL}/rest/v1/consultant_payments`, {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(row),
      });
      if (!res.ok) {
        const t = await res.text();
        return { statusCode: 500, headers, body: JSON.stringify({ error: t.slice(0, 200) }) };
      }
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
