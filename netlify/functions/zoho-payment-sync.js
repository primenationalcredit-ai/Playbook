// Zoho Payment Sync v2 Ã¢â‚¬â€ Faster: pulls payments + invoice list data only
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
async function getZohoToken(force) { return require('./zoho-token').get(force); } // 8/21 shared-token port; legacy body below is unused
async function getZohoTokenLegacy(force) {
  if (force) await require('./zoho-token').clear();
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
    // LIVE ROWS (Joe 8/21): rows payment-webhook wrote in real time - no
    // zoho_payment_id yet. When Zoho later shows the same payment, UPGRADE the
    // live row (stamp the payment id) instead of inserting a twin.
    const liveRes = await fetch(`${SUPABASE_URL}/rest/v1/consultant_payments?payment_month=eq.${targetMonth}&zoho_payment_id=is.null&select=id,zoho_invoice_id,pipedrive_deal_id,amount,payment_date,payment_type`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const liveRows = liveRes.ok ? await liveRes.json() : [];

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
    const parked = []; // NEVER GUESS (8/21): payments with no certain deal - recorded unattached + tasked for review

    for (const payment of payments) {
      if (existingSet.has(payment.payment_id)) { skipped++; continue; }
      if (payment.amount <= 0) continue;

      let paymentType = 'unknown';
      let liveInvoiceId = null;
      let dealId = null;

      // Look up invoice from list endpoint (has company_name + we can get item info)
      if (payment.invoice_numbers) {
        try {
          const invList = await zohoGet(token, `/invoices?invoice_number=${String(payment.invoice_numbers).split(',')[0].trim()}`);
          if (invList.invoices && invList.invoices.length > 0) {
            const inv = invList.invoices[0];
            liveInvoiceId = String(inv.invoice_id || '');
            // Deal resolution (Joe 8/18, Michael Cook mix-up): company_name is Zoho's
            // OWN deliberate, structured convention - "<dealId> <personId>" - set up
            // specifically to link an invoice back to Pipedrive reliably. This is now
            // the PRIMARY source, verified against Pipedrive's real person_id on the
            // resolved deal, since two different real clients can share the exact same
            // name and a name-based/free-text guess has no way to tell them apart.
            // reference_number (previously primary, unverified) is now only a last-resort
            // fallback when company_name doesn't carry the expected two-number format.
            // INVOICE IS THE TRUTH (Joe 8/21, Richard Martinez 269602/240401 -
            // same class as Luis Meza): our own billing records know which deal
            // owns this exact invoice, so resolve from the invoice FIRST. Only
            // when the invoice is unknown to us fall back to the company_name /
            // open-deal guessing below, which picked the wrong deal for repeat
            // clients with two open deals.
            try {
              const ivRows = await fetch(`${SUPABASE_URL}/rest/v1/consultant_invoices?zoho_invoice_id=eq.${encodeURIComponent(inv.invoice_id)}&select=pipedrive_deal_id&limit=1`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }).then(r => r.ok ? r.json() : []).catch(() => []);
              let invDeal = ivRows && ivRows[0] && ivRows[0].pipedrive_deal_id ? String(ivRows[0].pipedrive_deal_id) : null;
              if (!invDeal) {
                const PROC_KEY = process.env.PROCESSOR_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkc3hmemR0aGNzbmRsY2pnZmN1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTI4NTYxMSwiZXhwIjoyMDk0ODYxNjExfQ.2_Lx2lpSvogcN4W3nDsl8ZIEa_WgpKQJLwM9T9mANx0';
                const chRows = await fetch(`https://rdsxfzdthcsndlcjgfcu.supabase.co/rest/v1/scheduled_charges?zoho_invoice_id=eq.${encodeURIComponent(inv.invoice_id)}&select=pipedrive_deal_id&limit=1`, { headers: { apikey: PROC_KEY, Authorization: `Bearer ${PROC_KEY}` } }).then(r => r.ok ? r.json() : []).catch(() => []);
                invDeal = chRows && chRows[0] && chRows[0].pipedrive_deal_id ? String(chRows[0].pipedrive_deal_id) : null;
              }
              if (invDeal) dealId = invDeal;
            } catch (e) { /* invoice-first lookup is best-effort; contact fallback below */ }
            const cnNums = String(inv.company_name || '').match(/\d{4,}/g) || [];
            const cnDeal = cnNums[0] || null;
            const cnPerson = cnNums[1] || null;
            if (!dealId && cnDeal) {
              dealId = cnDeal;
              try {
                const pdTok = process.env.PIPEDRIVE_API_KEY || process.env.PIPEDRIVE_API_TOKEN;
                const dRes = await fetch(`https://asapcreditrepairusa.pipedrive.com/api/v1/deals/${cnDeal}?api_token=${pdTok}`);
                const dj = await dRes.json().catch(() => null);
                const d = dj && dj.data;
                const personId = d && d.person_id && (d.person_id.value || d.person_id);
                if (cnPerson && personId && String(personId) !== String(cnPerson)) {
                  // The deal number parsed but its real owner doesn't match the invoice's
                  // own embedded person_id - two different real clients likely share this
                  // name. Do not trust this deal id at all; fall through to reference_number.
                  console.error(`zoho-payment-sync: person_id mismatch for deal ${cnDeal} - invoice says person ${cnPerson}, Pipedrive says ${personId}. Discarding company_name match.`);
                  dealId = null;
                } else if (personId && d.status !== 'open') {
                  const odRes = await fetch(`https://asapcreditrepairusa.pipedrive.com/api/v1/persons/${personId}/deals?status=open&limit=50&api_token=${pdTok}`);
                  const odj = await odRes.json().catch(() => null);
                  const open = (odj && odj.data) || [];
                  // NEVER GUESS (Joe 8/21, Brandon Jackson - payment filed on his 2020
                  // deal 135371 instead of new deal 269915): exactly one open deal is
                  // evidence; several is a coin flip the sync must not take; zero open
                  // deals means the closed company_name deal is trusted only if recently
                  // active (final payment on a just-won deal), never a years-stale contact.
                  if (open.length === 1) {
                    dealId = open[0].id;
                  } else if (open.length > 1) {
                    console.error(`zoho-payment-sync: ${open.length} open deals for person ${personId}, refusing to guess for payment ${payment.payment_id}`);
                    dealId = null;
                  } else {
                    const cutoff90 = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0];
                    if (String(d.update_time || '') < cutoff90) {
                      console.error(`zoho-payment-sync: company_name deal ${cnDeal} closed + stale (updated ${d.update_time}), refusing for payment ${payment.payment_id}`);
                      dealId = null;
                    }
                  }
                }
              } catch (e) { /* verification failure keeps cnDeal - never blocks the payment import */ }
            }
            if (!dealId) dealId = parseDealId(inv.reference_number) || null;
            
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

      // LIVE-ROW UPGRADE (Joe 8/21): the dashboard already holds this payment as a
      // real-time row written at charge time. Stamp the Zoho payment id onto it and
      // move on - never insert a twin.
      const liveMatch = liveRows.find(lr => !lr._used && ((liveInvoiceId && lr.zoho_invoice_id && String(lr.zoho_invoice_id) === liveInvoiceId) || (dealId && lr.pipedrive_deal_id && String(lr.pipedrive_deal_id) === String(dealId) && Math.abs(parseFloat(lr.amount) - parseFloat(payment.amount)) < 0.01 && Math.abs(new Date(lr.payment_date) - new Date(payment.date)) <= 86400000)));
      if (liveMatch) {
        liveMatch._used = true;
        const up = { zoho_payment_id: payment.payment_id, source: 'zoho_api' };
        if (paymentType !== 'unknown') up.payment_type = paymentType;
        await fetch(`${SUPABASE_URL}/rest/v1/consultant_payments?id=eq.${liveMatch.id}`, { method: 'PATCH', headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }, body: JSON.stringify(up) }).catch(e => console.error('live-row upgrade failed:', e.message));
        skipped++;
        continue;
      }
      const row = {
        payment_date: payment.date,
        payment_month: targetMonth,
        amount: payment.amount,
        payment_type: paymentType,
        client_name: payment.customer_name,
        zoho_payment_id: payment.payment_id,
        zoho_invoice_id: liveInvoiceId || null,
        pipedrive_deal_id: dealId,
        consultant_name: 'pending_enrichment', // Will be filled by enrichment step
        source: 'zoho_api'
      };
      if (!dealId) { parked.push(row); } else { batch.push(row); }
      newRecords++;
    }

    if (parked.length > 0) {
      // Parked payments insert INDIVIDUALLY fail-open (a NOT NULL constraint or bad row
      // must never block the resolved batch), and each NEWLY inserted row opens a review
      // task. ignore-duplicates + return=representation = task fires exactly once per
      // payment, re-syncs skip silently.
      for (const p of parked) {
        try {
          const pr = await fetch(`${SUPABASE_URL}/rest/v1/consultant_payments`, {
            method: 'POST',
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation,resolution=ignore-duplicates' },
            body: JSON.stringify([p])
          });
          if (!pr.ok) { console.error('PARKED INSERT FAILED (payment ' + p.zoho_payment_id + '): ' + (await pr.text().catch(() => pr.status))); continue; }
          const ins = await pr.json().catch(() => []);
          if (ins.length) {
            const PD_T2 = process.env.PIPEDRIVE_API_TOKEN || process.env.PD_API_TOKEN;
            if (PD_T2) {
              await fetch(`https://asapcreditrepair.pipedrive.com/api/v1/activities?api_token=${PD_T2}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subject: `PAYMENT NEEDS REVIEW - ${p.client_name} $${parseFloat(p.amount).toFixed(2)} (no certain deal match)`, type: 'task', done: 0, note: `zoho-payment-sync could not attach this payment to a deal with hard evidence and refused to guess (Brandon Jackson class). Zoho payment ${p.zoho_payment_id}, date ${p.payment_date}, type ${p.payment_type}. Find the right deal and set pipedrive_deal_id on the consultant_payments row.` })
              }).catch(() => {});
            }
          }
        } catch (e) { console.error('Parked handling failed (non-fatal):', e.message); }
      }
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
        const TYPE_LBL = { doc_fee: 'Document Fee', partial: 'Partial', final: 'Final', paid_in_full: 'Paid in Full', additional_round: 'Additional Rounds', unknown: 'Partial' };
        for (const r of batch) {
          if (!PD_T || !r.pipedrive_deal_id) continue;
          try {
            const amt2 = parseFloat(r.amount).toFixed(2);
            const marker = `PAYMENT RECEIVED IN THE AMOUNT OF $${amt2} FOR`;
            const subj = `****${TYPE_LBL[String(r.payment_type)] || 'Partial'} PAYMENT RECEIVED IN THE AMOUNT OF $${amt2} FOR ${r.client_name}`;
            const exN = await fetch(`https://asapcreditrepair.pipedrive.com/api/v1/notes?deal_id=${r.pipedrive_deal_id}&api_token=${PD_T}&limit=30&sort=add_time DESC`).then(x => x.ok ? x.json() : { data: [] });
            const hasN = (exN.data || []).some(n => String(n.content || '').includes(marker) && String(n.add_time || '') >= r.payment_date);
            if (!hasN) await fetch(`https://asapcreditrepair.pipedrive.com/api/v1/notes?api_token=${PD_T}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deal_id: parseInt(r.pipedrive_deal_id, 10), content: subj }) });
            const exA = await fetch(`https://asapcreditrepair.pipedrive.com/api/v1/deals/${r.pipedrive_deal_id}/activities?api_token=${PD_T}&limit=100`).then(x => x.ok ? x.json() : { data: [] });
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
        month: targetMonth, page, paymentsScanned: payments.length,
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
    if (String(error && error.message || '').includes('Zoho 401')) { await require('./zoho-token').clear(); }
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message, selfHeal: String(error && error.message || '').includes('Zoho 401') ? 'token cache evicted - next run recovers' : undefined }) };
  }
};


