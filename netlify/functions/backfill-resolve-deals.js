// backfill-resolve-deals.js
// The fast backfill inserted payments with the right dollars but no deal id / type, so the normal
// enrichment (which needs a deal id) can't touch them. This fills that in: for each backfilled row it
// finds the payment's Zoho invoice number (from the customerpayments list, one call per page), maps that
// invoice number to its deal id using consultant_invoices (already synced, no extra Zoho call), and
// writes the deal id + an inferred fee type back onto the payment. Once the deal id is set, the regular
// payment-enrich step fills in the consultant name and affiliate flag.
//
// Processes the oldest month with unresolved rows, up to a batch cap, then reports what's left.
// Manual:  /.netlify/functions/backfill-resolve-deals
// Single:  /.netlify/functions/backfill-resolve-deals?month=2026-04

const ZOHO_CLIENT_ID = process.env.ZOHO_CLIENT_ID;
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;
const ZOHO_REFRESH_TOKEN = process.env.ZOHO_REFRESH_TOKEN;
const ZOHO_ORG_ID = process.env.ZOHO_ORG_ID;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
const supa = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
const BATCH = 60; // rows resolved per run

async function getZohoToken() { return require('./zoho-token').get(); } // 8/21 shared-token port; legacy body below is unused
async function getZohoTokenLegacy() {
  try {
    const c = await fetch(`${SUPABASE_URL}/rest/v1/app_cache?cache_key=eq.zoho_access_token&select=cache_value`, { headers: supa });
    if (c.ok) { const rows = await c.json(); if (rows[0]) { const t = JSON.parse(rows[0].cache_value); if (t.token && t.expiresAt > Date.now() + 60000) return t.token; } }
  } catch (e) {}
  const params = new URLSearchParams();
  params.append('grant_type', 'refresh_token');
  params.append('client_id', ZOHO_CLIENT_ID);
  params.append('client_secret', ZOHO_CLIENT_SECRET);
  params.append('refresh_token', ZOHO_REFRESH_TOKEN);
  const res = await fetch('https://accounts.zoho.com/oauth/v2/token', { method: 'POST', body: params });
  const data = await res.json();
  if (!data.access_token) throw new Error('Token failed: ' + JSON.stringify(data));
  try {
    const ttlMs = data.expires_in ? (data.expires_in * 1000 - 300000) : 3300000;
    await fetch(`${SUPABASE_URL}/rest/v1/app_cache`, { method: 'POST', headers: { ...supa, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ cache_key: 'zoho_access_token', cache_value: JSON.stringify({ token: data.access_token, expiresAt: Date.now() + ttlMs }), updated_at: new Date().toISOString() }) });
  } catch (e) {}
  return data.access_token;
}
async function zohoGet(token, endpoint) {
  const sep = endpoint.includes('?') ? '&' : '?';
  const res = await fetch(`https://www.zohoapis.com/invoice/v3${endpoint}${sep}organization_id=${ZOHO_ORG_ID}`, { headers: { Authorization: `Zoho-oauthtoken ${token}` } });
  if (!res.ok) throw new Error(`Zoho ${res.status}`);
  return await res.json();
}
function inferType(total) {
  const t = Math.round(parseFloat(total) || 0);
  if (t >= 140 && t <= 160) return 'doc_fee';
  if (t === 249 || t === 299) return 'additional_round';
  return null; // ambiguous (partial/final) -> leave as-is
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  try {
    const params = event.queryStringParameters || {};

    // Which month to work: the requested one, else the oldest month still carrying unresolved rows.
    let month = params.month;
    if (!month) {
      const mRes = await fetch(`${SUPABASE_URL}/rest/v1/consultant_payments?source=eq.zoho_backfill&pipedrive_deal_id=is.null&select=payment_month&order=payment_month.asc&limit=1`, { headers: supa });
      const rows = mRes.ok ? await mRes.json() : [];
      if (!rows[0]) return { statusCode: 200, headers, body: JSON.stringify({ message: 'Nothing left to resolve', remaining: 0 }) };
      month = rows[0].payment_month;
    }

    // invoice_number -> { dealId, total } from invoices we already have
    const invMap = {};
    let off = 0;
    while (true) {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/consultant_invoices?select=invoice_number,pipedrive_deal_id,total&limit=1000&offset=${off}`, { headers: supa });
      if (!r.ok) break;
      const rows = await r.json();
      for (const inv of rows) { if (inv.invoice_number) invMap[String(inv.invoice_number).trim()] = { dealId: inv.pipedrive_deal_id, total: inv.total }; }
      if (rows.length < 1000) break;
      off += 1000;
    }

    const token = await getZohoToken();

    // payment_id -> invoice_numbers for the month, from the Zoho customerpayments list
    const monthStart = `${month}-01`;
    const [y, m] = month.split('-').map(Number);
    const monthEnd = new Date(y, m, 0).toISOString().split('T')[0];
    const payInv = {};
    let page = 1, more = true, guard = 0;
    while (more && guard < 25) {
      guard++;
      const data = await zohoGet(token, `/customerpayments?date_start=${monthStart}&date_end=${monthEnd}&per_page=200&page=${page}`);
      const pays = data.customerpayments || [];
      for (const p of pays) if (p.payment_id) payInv[p.payment_id] = p.invoice_numbers || '';
      more = data.page_context?.has_more_page || false;
      page++;
      if (pays.length === 0) break;
    }

    // Unresolved backfilled rows for this month
    const uRes = await fetch(`${SUPABASE_URL}/rest/v1/consultant_payments?source=eq.zoho_backfill&pipedrive_deal_id=is.null&payment_month=eq.${month}&select=id,zoho_payment_id&limit=${BATCH}`, { headers: supa });
    const rows = uRes.ok ? await uRes.json() : [];

    let resolved = 0, noLink = 0;
    for (const row of rows) {
      const invNumsRaw = payInv[row.zoho_payment_id];
      const firstInv = invNumsRaw ? String(invNumsRaw).split(/[\s,]+/).filter(Boolean)[0] : null;
      const match = firstInv ? invMap[firstInv.trim()] : null;
      if (match && match.dealId) {
        const patch = { pipedrive_deal_id: match.dealId };
        const t = inferType(match.total);
        if (t) patch.payment_type = t;
        await fetch(`${SUPABASE_URL}/rest/v1/consultant_payments?id=eq.${row.id}`, { method: 'PATCH', headers: { ...supa, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(patch) });
        resolved++;
      } else {
        // couldn't link to an invoice/deal -> mark so we don't keep retrying it
        await fetch(`${SUPABASE_URL}/rest/v1/consultant_payments?id=eq.${row.id}`, { method: 'PATCH', headers: { ...supa, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ source: 'zoho_backfill_nolink' }) });
        noLink++;
      }
    }

    // How many unresolved remain (this month + overall)
    const remRes = await fetch(`${SUPABASE_URL}/rest/v1/consultant_payments?source=eq.zoho_backfill&pipedrive_deal_id=is.null&select=id&limit=1`, { headers: { ...supa, Prefer: 'count=exact' } });
    const remaining = parseInt(remRes.headers?.get('content-range')?.split('/')?.[1]) || 0;

    return { statusCode: 200, headers, body: JSON.stringify({ month, processed: rows.length, resolved, noLink, remaining, nextUrl: remaining > 0 ? '/.netlify/functions/backfill-resolve-deals' : null }) };
  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};

