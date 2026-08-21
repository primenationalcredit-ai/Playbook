// netlify/functions/zoho-payment-sync-manual.js - keyed on-demand twin (Joe 8/14, Nathan Reyes 253584: AR payment missing from consultant_payments, needed a way to fire this on demand instead of guessing at scheduled-run behavior - same pattern as every other -manual door built tonight, since Netlify blocks direct HTTP on functions registered with a schedule regardless of the function's own code). Identical logic to the scheduled original.
// Zoho Payment Sync v2 — Faster: pulls payments + invoice list data only
// Enrichment (Pipedrive deal lookups) done separately to avoid timeouts
const ZOHO_CLIENT_ID = process.env.ZOHO_CLIENT_ID;
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;
const ZOHO_REFRESH_TOKEN = process.env.ZOHO_REFRESH_TOKEN;
const ZOHO_ORG_ID = process.env.ZOHO_ORG_ID;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function clearZohoTokenCache() {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/app_cache?cache_key=eq.zoho_access_token`, {
      method: 'DELETE',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, Prefer: 'return=minimal' }
    });
  } catch (e) {}
}
async function getZohoToken(force) {
  if (force) await clearZohoTokenCache();
  // Reuse a cached access token (Zoho tokens last ~1 hour). Minting a new one on
  // every call trips Zoho's refresh rate limit, which 500s the whole sync.
  try {
    if (force) throw new Error('skip cache');
    const c = await fetch(`${SUPABASE_URL}/rest/v1/app_cache?cache_key=eq.zoho_access_token&select=cache_value`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    if (c.ok) {
      const rows = await c.json();
      if (rows[0]) {
        const t = JSON.parse(rows[0].cache_value);
        if (t.token && t.expiresAt > Date.now() + 60000) return t.token;
      }
    }
  } catch (e) {}

  const params = new URLSearchParams();
  params.append('grant_type', 'refresh_token');
  params.append('client_id', ZOHO_CLIENT_ID);
  params.append('client_secret', ZOHO_CLIENT_SECRET);
  params.append('refresh_token', ZOHO_REFRESH_TOKEN);
  const res = await fetch('https://accounts.zoho.com/oauth/v2/token', { method: 'POST', body: params });
  const data = await res.json();
  if (!data.access_token) throw new Error('Token failed: ' + JSON.stringify(data));

  // Cache it, refreshing 5 minutes before Zoho's stated expiry
  try {
    const ttlMs = data.expires_in ? (data.expires_in * 1000 - 300000) : 3300000;
    await fetch(`${SUPABASE_URL}/rest/v1/app_cache`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ cache_key: 'zoho_access_token', cache_value: JSON.stringify({ token: data.access_token, expiresAt: Date.now() + ttlMs }), updated_at: new Date().toISOString() })
    });
  } catch (e) {}
  return data.access_token;
}

async function zohoGet(token, endpoint) {
  const sep = endpoint.includes('?') ? '&' : '?';
  const url = `https://www.zohoapis.com/invoice/v3${endpoint}${sep}organization_id=${ZOHO_ORG_ID}`;
  const res = await fetch(url, { headers: { 'Authorization': `Zoho-oauthtoken ${token}` } });
  if (!res.ok) { const err = await res.text(); throw new Error(`Zoho ${res.status}: ${err}`); }
  return await res.json();
}

async function zohoGetRetry(token, endpoint) {
  try { return await zohoGet(token, endpoint); }
  catch (e) { await new Promise(r => setTimeout(r, 800)); return await zohoGet(token, endpoint); }
}
function parsePaymentType(itemName) {
  if (!itemName) return 'additional_round';
  const n = itemName.toLowerCase();
  if (n.includes('doc') || n === 'doc1') return 'doc_fee';
  if (n.includes('par') || n === 'par1') return 'partial';
  if (n.includes('fin') || n === 'fin1') return 'final';
  if (n.includes('pif') || n.includes('full')) return 'paid_in_full';
  // Anything else is an additional round
  return 'additional_round';
}

function parseDealId(companyName) {
  if (!companyName) return null;
  const parts = companyName.trim().split(/\s+/);
  const id = parseInt(parts[0]);
  return isNaN(id) || id < 1 ? null : id;
}

exports.handler = async (event) => {
  const _key = (event.headers && (event.headers['x-api-key'] || event.headers['X-API-Key'])) || (event.queryStringParameters && event.queryStringParameters.key);
  if (!_key || _key !== process.env.INTERNAL_API_KEY) return { statusCode: 401, body: JSON.stringify({ error: 'Invalid API key' }) };

  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  try {
    const params = event.queryStringParameters || {};
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const targetMonth = params.month || currentMonth;
    const monthStart = `${targetMonth}-01`;
    // Calculate month end
    const [y, m] = targetMonth.split('-').map(Number);
    const monthEnd = new Date(y, m, 0).toISOString().split('T')[0]; // last day of month
    const page = parseInt(params.page) || 1;
    const perPage = 25; // Larger batches since we're not doing Pipedrive lookups

    const token = await getZohoToken();

    // Get existing payments to skip
    const existRes = await fetch(`${SUPABASE_URL}/rest/v1/consultant_payments?payment_month=eq.${targetMonth}&select=zoho_payment_id`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const existing = existRes.ok ? await existRes.json() : [];
    const existingSet = new Set(existing.map(e => e.zoho_payment_id).filter(Boolean));

    // Pull payments
    if (params.repair_month) {
      const rm = params.repair_month;
      const unkRes = await fetch(`${SUPABASE_URL}/rest/v1/consultant_payments?payment_month=eq.${rm}&payment_type=eq.unknown&select=id,zoho_payment_id,amount`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      const unknowns = unkRes.ok ? await unkRes.json() : [];
      let repaired = 0, still = 0;
      for (const row of unknowns) {
        let newType = 'unknown';
        if (row.zoho_payment_id) {
          try {
            const pd = await zohoGetRetry(token, `/customerpayments/${row.zoho_payment_id}`);
            const invRef = pd.payment && pd.payment.invoices && pd.payment.invoices[0];
            if (invRef && invRef.invoice_id) {
              const invDetail = await zohoGetRetry(token, `/invoices/${invRef.invoice_id}`);
              if (invDetail.invoice && invDetail.invoice.line_items && invDetail.invoice.line_items[0]) {
                newType = parsePaymentType(invDetail.invoice.line_items[0].name);
              }
            }
          } catch (e) { console.log(`repair lookup failed for payment ${row.zoho_payment_id}:`, e.message); }
        }
        if (newType === 'unknown') {
          const amt = Math.round(parseFloat(row.amount) || 0);
          if (amt === 149) newType = 'doc_fee';
          else if (amt === 249 || amt === 299) newType = 'additional_round';
        }
        if (newType !== 'unknown') {
          await fetch(`${SUPABASE_URL}/rest/v1/consultant_payments?id=eq.${row.id}`, {
            method: 'PATCH',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
            body: JSON.stringify({ payment_type: newType })
          });
          repaired++;
        } else still++;
      }
      return { statusCode: 200, headers, body: JSON.stringify({ repair_month: rm, examined: unknowns.length, repaired, still_unknown: still }) };
    }
    const paymentsData = await zohoGet(token, `/customerpayments?date_start=${monthStart}&date_end=${monthEnd}&sort_column=date&sort_order=D&per_page=${perPage}&page=${page}`);
    const payments = paymentsData.customerpayments || [];
    const hasMore = paymentsData.page_context?.has_more_page || false;

    let newRecords = 0, skipped = 0;
    const batch = [];

    for (const payment of payments) {
      if (existingSet.has(payment.payment_id)) { skipped++; continue; }
      if (payment.amount <= 0) continue;

      let paymentType = 'unknown';
      let dealId = null;

      // Look up invoice from list endpoint (has company_name + we can get item info)
      if (payment.invoice_numbers) {
        try {
          const invList = await zohoGet(token, `/invoices?invoice_number=${String(payment.invoice_numbers).split(',')[0].trim()}`);
          if (invList.invoices && invList.invoices.length > 0) {
            const inv = invList.invoices[0];
            // Get deal_id from company_name
            // Deal resolution (Joe 7/24): invoice's own reference first; the
            // customer-level company_name is stale for repeat clients, so any
            // deal it names must be verified - not open + person has an open
            // deal => the payment belongs to the newest OPEN deal instead.
            dealId = parseDealId(inv.reference_number) || null;
            if (!dealId) {
              const cnDeal = parseDealId(inv.company_name);
              if (cnDeal) {
                dealId = cnDeal;
                try {
                  const pdTok = process.env.PIPEDRIVE_API_KEY || process.env.PIPEDRIVE_API_TOKEN;
                  const dRes = await fetch(`https://asapcreditrepairusa.pipedrive.com/api/v1/deals/${cnDeal}?api_token=${pdTok}`);
                  const dj = await dRes.json().catch(() => null);
                  const d = dj && dj.data;
                  const personId = d && d.person_id && (d.person_id.value || d.person_id);
                  if (personId && d.status !== 'open') {
                    const odRes = await fetch(`https://asapcreditrepairusa.pipedrive.com/api/v1/persons/${personId}/deals?status=open&limit=50&api_token=${pdTok}`);
                    const odj = await odRes.json().catch(() => null);
                    const open = (odj && odj.data) || [];
                    if (open.length) {
                      open.sort((a, b) => String(b.update_time || '').localeCompare(String(a.update_time || '')));
                      dealId = open[0].id;
                    }
                  }
                } catch (e) { /* verification failure keeps cnDeal - never blocks the payment import */ }
              }
            }
            
            // Get payment type from full invoice (need line_items)
            try {
              const invDetail = await zohoGetRetry(token, `/invoices/${inv.invoice_id}`);
              if (invDetail.invoice?.line_items?.[0]) {
                paymentType = parsePaymentType(invDetail.invoice.line_items[0].name);
              }
            } catch (e) {
              // If detail fails, try to infer from amount
              console.log(`Detail lookup failed for ${inv.invoice_id}, using amount heuristic`);
            }
          }
        } catch (e) {
          console.log(`Invoice lookup failed for ${payment.invoice_numbers}:`, e.message);
        }
      }

      // $249 or $299 with no Doc, Partial, or Final code is an additional round, credited to the AM.
      // Only applies when classification fell through to unknown (blank item name, no invoice match,
      // or the detail lookup failed). Never overrides a real doc_fee/partial/final/paid_in_full code.
      if (paymentType === 'unknown') {
        const amt = Math.round(parseFloat(payment.amount) || 0);
        if (amt === 149) paymentType = 'doc_fee'; else if (amt === 249 || amt === 299) paymentType = 'additional_round';
      }

      batch.push({
        payment_date: payment.date,
        payment_month: targetMonth,
        amount: payment.amount,
        payment_type: paymentType,
        client_name: payment.customer_name,
        zoho_payment_id: payment.payment_id,
        pipedrive_deal_id: dealId,
        consultant_name: 'pending_enrichment', // Will be filled by enrichment step
        source: 'zoho_api'
      });
      newRecords++;
    }

    if (batch.length > 0) {
      const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/consultant_payments`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal,resolution=ignore-duplicates'
        },
        body: JSON.stringify(batch)
      });
      if (!insertRes.ok) console.error('Insert error:', await insertRes.text());
      // PIPEDRIVE NOTE + ACTIVITY (Joe 8/21, Victor Argueta 267884 + 13 others):
      // zoho_api-sourced payments recorded money but never told Pipedrive - the
      // third ingestion path missing this (autobill + payment-webhook fixed 8/20).
      // Idempotent: checks the deal for the exact marker first, so re-syncs and
      // ignore-duplicates re-batches can never double-post. Fail-open per row.
      if (insertRes.ok) {
        const PD_T = process.env.PIPEDRIVE_API_TOKEN || process.env.PD_API_TOKEN;
        const TYPE_LBL = { doc_fee: 'Document Fee', partial: 'Partial', final: 'Final', paid_in_full: 'Final', additional_round: 'Additional Rounds', unknown: 'Partial' };
        for (const r of batch) {
          if (!PD_T || !r.pipedrive_deal_id) continue;
          try {
            const amt2 = parseFloat(r.amount).toFixed(2);
            const marker = `PAYMENT RECEIVED IN THE AMOUNT OF $${amt2} FOR`;
            const subj = `****${TYPE_LBL[String(r.payment_type)] || 'Partial'} PAYMENT RECEIVED IN THE AMOUNT OF $${amt2} FOR ${r.client_name}`;
            const exN = await fetch(`https://asapcreditrepair.pipedrive.com/api/v1/notes?deal_id=${r.pipedrive_deal_id}&api_token=${PD_T}&limit=30&sort=add_time DESC`).then(x => x.ok ? x.json() : { data: [] });
            const hasN = (exN.data || []).some(n => String(n.content || '').includes(marker) && String(n.add_time || '') >= r.payment_date);
            if (!hasN) await fetch(`https://asapcreditrepair.pipedrive.com/api/v1/notes?api_token=${PD_T}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deal_id: parseInt(r.pipedrive_deal_id, 10), content: subj }) });
            const exA = await fetch(`https://asapcreditrepair.pipedrive.com/api/v1/deals/${r.pipedrive_deal_id}/activities?api_token=${PD_T}&limit=50`).then(x => x.ok ? x.json() : { data: [] });
            const hasA = (exA.data || []).some(a => String(a.subject || '').includes(marker) && String(a.add_time || '') >= r.payment_date);
            if (!hasA) await fetch(`https://asapcreditrepair.pipedrive.com/api/v1/activities?api_token=${PD_T}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subject: subj, type: 'payment', deal_id: parseInt(r.pipedrive_deal_id, 10), done: 0, due_date: r.payment_date }) });
            // Payment received -> clear open DECLINE notifications on the deal
            // (Joe 8/21): once money is in, nobody should see a decline chase.
            try {
              const opnA = await fetch(`https://asapcreditrepair.pipedrive.com/api/v1/deals/${r.pipedrive_deal_id}/activities?api_token=${PD_T}&limit=50&done=0`).then(x => x.ok ? x.json() : { data: [] });
              for (const oa of (opnA.data || [])) {
                if (/DECLINE/i.test(String(oa.subject || ''))) {
                  await fetch(`https://asapcreditrepair.pipedrive.com/api/v1/activities/${oa.id}?api_token=${PD_T}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ done: 1 }) });
                }
              }
            } catch (e) { /* decline-clear is best-effort */ }
          } catch (e) { console.error('note/activity post failed (non-fatal) deal ' + r.pipedrive_deal_id + ':', e.message); }
        }
      }
      // New payments landed: bust the bonus caches for every month written so the
      // next page load recomputes. No payment may exist that a report can't see.
      if (insertRes.ok) {
        try {
          const monthsTouched = [...new Set(batch.map(r => r.payment_month).filter(Boolean))];
          for (const m of monthsTouched) {
            await fetch(`${SUPABASE_URL}/rest/v1/app_cache?cache_key=eq.consultant_bonus_${m}`, {
              method: 'DELETE', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
            }).catch(() => {});
          }
          if (monthsTouched.length) console.log('Busted bonus cache for: ' + monthsTouched.join(', '));
        } catch (e) { console.error('Cache bust failed (non-fatal):', e.message); }
      }
    }

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        month: targetMonth, page, paymentsScanned: payments.length, batchPreview: batch,
        newRecords, skipped, hasMore,
        nextUrl: hasMore ? `/.netlify/functions/zoho-payment-sync?month=${targetMonth}&page=${page + 1}` : null,
        syncedAt: now.toISOString()
      })
    };
  } catch (error) {
    console.error('Zoho sync error:', error);
    // Self-heal: a Zoho 401 means the cached token was invalidated (Zoho keeps
    // a limited number of live access tokens; new mints kill old ones). Evict
    // it so the next run - 5 minutes away - mints fresh and succeeds.
    if (String(error && error.message || '').includes('Zoho 401')) { await clearZohoTokenCache(); }
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message, selfHeal: String(error && error.message || '').includes('Zoho 401') ? 'token cache evicted - next run recovers' : undefined }) };
  }
};

