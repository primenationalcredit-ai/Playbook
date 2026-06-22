// zoho-payment-backfill.js
// One-shot backfill that pulls EVERY customer payment for a year and inserts any that are missing from
// consultant_payments. Unlike the hourly sync, this paginates through all pages of every month, and it
// SKIPS the slow per-payment invoice lookups (deal id + payment type) so it can cover the whole year in
// one run without timing out. Amount, date, month, client and the Zoho payment id are written; deal id /
// payment type stay null/unknown and get filled in later by the normal enrichment step. The headline
// dollar totals (which only need amount + month) are correct immediately.
//
// Trigger once:  /.netlify/functions/zoho-payment-backfill?year=2026
// Optional single month:  /.netlify/functions/zoho-payment-backfill?month=2026-03

const ZOHO_CLIENT_ID = process.env.ZOHO_CLIENT_ID;
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;
const ZOHO_REFRESH_TOKEN = process.env.ZOHO_REFRESH_TOKEN;
const ZOHO_ORG_ID = process.env.ZOHO_ORG_ID;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

async function getZohoToken() {
  try {
    const c = await fetch(`${SUPABASE_URL}/rest/v1/app_cache?cache_key=eq.zoho_access_token&select=cache_value`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
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
    await fetch(`${SUPABASE_URL}/rest/v1/app_cache`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ cache_key: 'zoho_access_token', cache_value: JSON.stringify({ token: data.access_token, expiresAt: Date.now() + ttlMs }), updated_at: new Date().toISOString() })
    });
  } catch (e) {}
  return data.access_token;
}

async function zohoGet(token, endpoint) {
  const sep = endpoint.includes('?') ? '&' : '?';
  const url = `https://www.zohoapis.com/invoice/v3${endpoint}${sep}organization_id=${ZOHO_ORG_ID}`;
  const res = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${token}` } });
  if (!res.ok) { const err = await res.text(); throw new Error(`Zoho ${res.status}: ${err}`); }
  return await res.json();
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  try {
    const params = event.queryStringParameters || {};
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Which months to cover
    let months = [];
    if (params.month) {
      months = [params.month];
    } else {
      const year = parseInt(params.year) || now.getFullYear();
      for (let m = 1; m <= 12; m++) {
        const mm = `${year}-${String(m).padStart(2, '0')}`;
        if (mm <= currentMonth) months.push(mm); // don't bother with future months
      }
    }

    const token = await getZohoToken();
    const perPage = 200;
    const results = {};
    let totalInserted = 0, totalScanned = 0;

    for (const month of months) {
      const monthStart = `${month}-01`;
      const [y, m] = month.split('-').map(Number);
      const monthEnd = new Date(y, m, 0).toISOString().split('T')[0];

      // existing payment ids for this month (skip them)
      const existRes = await fetch(`${SUPABASE_URL}/rest/v1/consultant_payments?payment_month=eq.${month}&select=zoho_payment_id&limit=10000`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      });
      const existing = existRes.ok ? await existRes.json() : [];
      const existingSet = new Set(existing.map(e => e.zoho_payment_id).filter(Boolean));

      let page = 1, hasMore = true, inserted = 0, scanned = 0, guard = 0;
      while (hasMore && guard < 50) {
        guard++;
        const data = await zohoGet(token, `/customerpayments?date_start=${monthStart}&date_end=${monthEnd}&sort_column=date&sort_order=D&per_page=${perPage}&page=${page}`);
        const payments = data.customerpayments || [];
        hasMore = data.page_context?.has_more_page || false;
        scanned += payments.length;

        const batch = [];
        for (const p of payments) {
          if (!p.payment_id || existingSet.has(p.payment_id)) continue;
          if (!(p.amount > 0)) continue;
          existingSet.add(p.payment_id);
          batch.push({
            payment_date: p.date,
            payment_month: month,
            amount: p.amount,
            payment_type: 'unknown',          // filled in later by enrichment
            client_name: p.customer_name,
            zoho_payment_id: p.payment_id,
            pipedrive_deal_id: null,           // filled in later by enrichment
            consultant_name: 'pending_enrichment',
            source: 'zoho_backfill'
          });
        }
        if (batch.length > 0) {
          const ins = await fetch(`${SUPABASE_URL}/rest/v1/consultant_payments`, {
            method: 'POST',
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal,resolution=ignore-duplicates' },
            body: JSON.stringify(batch)
          });
          if (ins.ok) inserted += batch.length;
          else console.error(`Insert error ${month}:`, await ins.text());
        }
        page++;
        if (payments.length === 0) break;
      }
      results[month] = { scanned, inserted };
      totalScanned += scanned;
      totalInserted += inserted;
    }

    return { statusCode: 200, headers, body: JSON.stringify({ months, totalScanned, totalInserted, byMonth: results, note: 'Run the enrichment step to fill consultant + affiliate fields on the new rows.', at: now.toISOString() }) };
  } catch (error) {
    console.error('Backfill error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};
