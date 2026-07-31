// All Payments: list + manual add for consultant_payments (service-role, bypasses RLS)
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  try {
    if (event.httpMethod === 'GET') {
      const month = (event.queryStringParameters || {}).month || 'all';
      const filter = month && month !== 'all' ? `payment_month=eq.${month}&` : '';
      const pageSize = 1000; // Supabase caps each request; page through all rows
      let payments = [], offset = 0;
      while (true) {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/consultant_payments?refunded_at=is.null&${filter}order=payment_date.desc&select=*&limit=${pageSize}&offset=${offset}`, {
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Range-Unit': 'items', Range: `${offset}-${offset + pageSize - 1}` },
        });
        if (!res.ok) break;
        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) break;
        payments = payments.concat(data);
        if (data.length < pageSize) break;
        offset += pageSize;
        if (month === 'all' && offset >= 5000) break; // all-time capped: newest 5000 rows (full walk 502s past the fn time limit)
        if (offset > 200000) break;
      }
      return { statusCode: 200, headers, body: JSON.stringify({ payments }) };
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

    if (event.httpMethod === 'PATCH') {
      const b = JSON.parse(event.body || '{}');
      if (!b.id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id is required' }) };
      // Only set the fields that were sent. Empty string clears the optional fields.
      const patch = {};
      if (b.client_name !== undefined) patch.client_name = String(b.client_name || '').trim();
      if (b.amount !== undefined && b.amount !== null && b.amount !== '') patch.amount = parseFloat(b.amount);
      if (b.payment_type !== undefined) patch.payment_type = b.payment_type;
      if (b.payment_date !== undefined && b.payment_date) {
        patch.payment_date = b.payment_date;
        patch.payment_month = String(b.payment_date).slice(0, 7);
      }
      if (b.consultant_name !== undefined) patch.consultant_name = b.consultant_name ? String(b.consultant_name).trim() : null;
      if (b.pipedrive_deal_id !== undefined) patch.pipedrive_deal_id = b.pipedrive_deal_id ? String(b.pipedrive_deal_id).trim() : null;
      if (Object.keys(patch).length === 0) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'nothing to update' }) };
      }
      const res = await fetch(`${SUPABASE_URL}/rest/v1/consultant_payments?id=eq.${encodeURIComponent(b.id)}`, {
        method: 'PATCH',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const t = await res.text();
        return { statusCode: 500, headers, body: JSON.stringify({ error: t.slice(0, 200) }) };
      }
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    if (event.httpMethod === 'DELETE') {
      const b = JSON.parse(event.body || '{}');
      // Two modes:
      //   { id }            -> delete a single payment row
      //   { client_email }  -> delete ALL payments with that exact email (test cleanup)
      let filter = null, scope = null;
      if (b.id) { filter = `id=eq.${encodeURIComponent(b.id)}`; scope = `id ${b.id}`; }
      else if (b.client_email) { filter = `client_email=eq.${encodeURIComponent(String(b.client_email).trim())}`; scope = `email ${b.client_email}`; }
      else return { statusCode: 400, headers, body: JSON.stringify({ error: 'id or client_email is required' }) };

      const res = await fetch(`${SUPABASE_URL}/rest/v1/consultant_payments?${filter}`, {
        method: 'DELETE',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      });
      if (!res.ok) {
        const t = await res.text();
        return { statusCode: 500, headers, body: JSON.stringify({ error: t.slice(0, 200) }) };
      }
      const deleted = await res.json().catch(() => []);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, deleted: Array.isArray(deleted) ? deleted.length : 0, scope }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
