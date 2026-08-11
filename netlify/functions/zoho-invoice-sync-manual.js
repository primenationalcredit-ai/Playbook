// MANUAL DOOR for zoho-invoice-sync (scheduled functions 403 direct HTTP - known gotcha).
// Identical logic, HTTP-invokable, for targeted window re-walks like Elizabeth Ferguson 268497.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ZOHO_CLIENT_ID = process.env.ZOHO_CLIENT_ID;
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;
const ZOHO_REFRESH_TOKEN = process.env.ZOHO_REFRESH_TOKEN;
const ZOHO_ORG_ID = process.env.ZOHO_ORG_ID;

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };

async function getZohoToken() {
  const res = await fetch(`https://accounts.zoho.com/oauth/v2/token?refresh_token=${ZOHO_REFRESH_TOKEN}&client_id=${ZOHO_CLIENT_ID}&client_secret=${ZOHO_CLIENT_SECRET}&grant_type=refresh_token`, { method: 'POST' });
  const data = await res.json();
  return data.access_token;
}

async function zohoGet(token, path) {
  const res = await fetch(`https://www.zohoapis.com/invoice/v3${path}&organization_id=${ZOHO_ORG_ID}`, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` }
  });
  return res.json();
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  try {
    const token = await getZohoToken();
    const params = event.queryStringParameters || {};
    const page = parseInt(params.page) || 1;
    const perPage = 25;
    
    // Pull invoices — can filter by status or date range
    // Default: pull all invoices to get full picture
    const statusFilter = params.status || ''; // overdue, partially_paid, unpaid, paid
    let url = `/invoices?sort_column=date&sort_order=D&per_page=${perPage}&page=${page}`;
    if (statusFilter) url += `&status=${statusFilter}`;
    
    // Date range filtering
    if (params.due_start) url += `&due_date_start=${params.due_start}`;
    if (params.due_end) url += `&due_date_end=${params.due_end}`;
    if (params.date_start) url += `&date_start=${params.date_start}`;
    if (params.date_end) url += `&date_end=${params.date_end}`;

    const data = await zohoGet(token, url);
    const invoices = data.invoices || [];

    if (invoices.length === 0) {
      return { statusCode: 200, headers, body: JSON.stringify({ page, invoicesScanned: 0, upserted: 0, hasMore: false }) };
    }

    let upserted = 0;
    for (const inv of invoices) {
      // Company field holds two numbers: "<dealId> <personId>" (deal first, person second).
      const nums = String(inv.company_name || inv.customer_name || '').match(/\d{4,}/g) || [];
      const dealId = nums[0] || null;

      const invoiceMonth = inv.date ? inv.date.substring(0, 7) : null;

      const record = {
        zoho_invoice_id: inv.invoice_id,
        customer_name: inv.customer_name,
        invoice_number: inv.invoice_number,
        total: inv.total || 0,
        balance: inv.balance || 0,
        due_date: inv.due_date,
        status: inv.status,
        invoice_date: inv.date,
        invoice_month: invoiceMonth,
        pipedrive_deal_id: dealId,
        updated_at: new Date().toISOString()
      };

      // Upsert on zoho_invoice_id (requires a unique constraint on that column). A re-sync overwrites
      // the existing row in place, so balances stay current and rows never duplicate.
      await fetch(`${SUPABASE_URL}/rest/v1/consultant_invoices?on_conflict=zoho_invoice_id`, {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(record)
      });
      upserted++;
    }

    const hasMore = invoices.length === perPage;

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        page, invoicesScanned: invoices.length, upserted, hasMore,
        nextUrl: hasMore ? `/.netlify/functions/zoho-invoice-sync?page=${page + 1}${statusFilter ? '&status=' + statusFilter : ''}` : null,
        syncedAt: new Date().toISOString()
      })
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
