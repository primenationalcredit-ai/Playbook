// Payment Webhook — Receives payment events from Zapier or Zoho
// POST with JSON body: { client_name, amount, payment_type, consultant_name, ... }
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
  }

  try {
    // Zoho's webhook may deliver JSON or form-encoded (JSONString=... / raw params).
    // Parse permissively; a format we can't read is logged and skipped (200), never a 5xx.
    let body = {};
    const raw = event.body || '';
    try { body = JSON.parse(raw || '{}'); }
    catch (e1) {
      try {
        const params = new URLSearchParams(raw);
        const js = params.get('JSONString') || params.get('jsonstring');
        if (js) body = JSON.parse(js);
        else { body = {}; for (const [k, v] of params.entries()) body[k] = v; }
      } catch (e2) {
        console.log('[payment-webhook] unparseable body, skipping. first 300 chars:', String(raw).slice(0, 300));
        return { statusCode: 200, headers, body: JSON.stringify({ skipped: true, reason: 'unparseable body' }) };
      }
    }
    
    // Validate required fields
    if (!body.client_name || !body.amount || !body.consultant_name) {
      // Acknowledge with 200 so Zoho doesn't count this as a webhook failure and
      // deactivate us (7/29 warning email). Test invoices and events without a
      // consultant field land here; they're logged and skipped, not errors.
      console.log('[payment-webhook] skipped - missing fields', JSON.stringify({ received: Object.keys(body), client: body.client_name || null, amount: body.amount || null }));
      return { statusCode: 200, headers, body: JSON.stringify({
        skipped: true, reason: 'Missing required fields: client_name, amount, consultant_name',
        received: Object.keys(body)
      })};
    }

    const now = new Date();
    const paymentDate = body.payment_date || now.toISOString().split('T')[0];
    const paymentMonth = paymentDate.substring(0, 7); // '2026-06'

    // Determine payment type from amount or explicit field
    let paymentType = body.payment_type || 'unknown';
    if (paymentType === 'unknown' && body.invoice_description) {
      const desc = body.invoice_description.toLowerCase();
      if (desc.includes('doc fee') || desc.includes('document fee')) paymentType = 'doc_fee';
      else if (desc.includes('partial')) paymentType = 'partial';
      else if (desc.includes('final')) paymentType = 'final';
      else if (desc.includes('paid in full') || desc.includes('pif')) paymentType = 'paid_in_full';
      else if (desc.includes('additional') || desc.includes('round')) paymentType = 'additional_round';
    }
    // $249 or $299 with no Doc, Partial, or Final code is an additional round, credited to the AM.
    if (paymentType === 'unknown') {
      const amt = Math.round(parseFloat(body.amount) || 0);
      if (amt === 249 || amt === 299) paymentType = 'additional_round';
    }

    const record = {
      payment_date: paymentDate,
      payment_month: paymentMonth,
      amount: parseFloat(body.amount) || 0,
      payment_type: paymentType,
      client_name: body.client_name,
      client_email: body.client_email || null,
      zoho_invoice_id: body.zoho_invoice_id || body.invoice_id || null,
      zoho_payment_id: body.zoho_payment_id || body.payment_id || null,
      pipedrive_deal_id: body.pipedrive_deal_id || body.deal_id || null,
      consultant_name: body.consultant_name,
      is_affiliate_deal: body.is_affiliate === true || body.is_affiliate === 'true' || false,
      referrer_org: body.referrer_org || body.affiliate_name || null,
      source: body.source || 'zapier'
    };


    // INVOICE IS THE TRUTH (Joe 8/20, Luis Meza 239862/239967 - repeat clients
    // with two deals kept getting payments pushed to the WRONG deal because the
    // Zap reads the deal id off the Zoho CONTACT, and duplicate/repeat-client
    // contacts carry stale or doubled deal ids). The payment always knows which
    // INVOICE it paid, and our own records know which deal owns each invoice -
    // so resolve the deal FROM THE INVOICE first, and only trust the
    // contact-supplied deal id when the invoice is unknown to us.
    if (record.zoho_invoice_id) {
      try {
        const invRows = await fetch(`${SUPABASE_URL}/rest/v1/consultant_invoices?zoho_invoice_id=eq.${encodeURIComponent(record.zoho_invoice_id)}&select=pipedrive_deal_id&limit=1`, {
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        }).then(r => r.ok ? r.json() : []);
        let trueDeal = invRows && invRows[0] && invRows[0].pipedrive_deal_id ? String(invRows[0].pipedrive_deal_id) : null;
        if (!trueDeal) {
          const chRows = await fetch(`https://rdsxfzdthcsndlcjgfcu.supabase.co/rest/v1/scheduled_charges?zoho_invoice_id=eq.${encodeURIComponent(record.zoho_invoice_id)}&select=pipedrive_deal_id&limit=1`, {
            headers: { 'apikey': process.env.PROCESSOR_SUPABASE_KEY || '', 'Authorization': `Bearer ${process.env.PROCESSOR_SUPABASE_KEY || ''}` }
          }).then(r => r.ok ? r.json() : []).catch(() => []);
          trueDeal = chRows && chRows[0] && chRows[0].pipedrive_deal_id ? String(chRows[0].pipedrive_deal_id) : null;
        }
        if (trueDeal && String(record.pipedrive_deal_id || '') !== trueDeal) {
          console.log(`[deal-correction] invoice ${record.zoho_invoice_id}: contact said deal ${record.pipedrive_deal_id}, invoice belongs to deal ${trueDeal} - using the invoice's deal`);
          record.pipedrive_deal_id = trueDeal;
        }
      } catch (e) { console.error('[deal-correction] lookup failed, keeping provided deal id:', e.message); }
    }
    // Insert to Supabase
    const res = await fetch(`${SUPABASE_URL}/rest/v1/consultant_payments`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal,resolution=merge-duplicates'
      },
      body: JSON.stringify(record)
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Supabase insert error:', err);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to save payment', detail: err }) };
    }

    console.log(`Payment recorded: ${record.client_name} - $${record.amount} - ${record.payment_type} - ${record.consultant_name}`);

    // PIPEDRIVE NOTE + ACTIVITY (Joe 8/20, Jamesha Finney 257336): payments made
    // via autobill or a manually-sent Zoho invoice never got a note or activity
    // on the deal - only card-on-file payments did. Every payment through this
    // webhook now gets both, in the same format Joe/the team already use
    // ("****<Type> PAYMENT RECEIVED IN THE AMOUNT OF $X.XX FOR <name>").
    // Awaited (not fire-and-forget) so it can't get killed by the function
    // returning before it finishes - the exact bug found earlier tonight in
    // process-initial-payment.js's note posting. Fail-open: wrapped in its own
    // try/catch so a Pipedrive hiccup never blocks the payment record itself.
    const PD_TOKEN2 = process.env.PIPEDRIVE_API_TOKEN || process.env.PD_API_TOKEN;
    if (PD_TOKEN2 && record.pipedrive_deal_id) {
      try {
        const TYPE_LABEL = { doc_fee: 'Document Fee', partial: 'Partial', final: 'Final', paid_in_full: 'Final', additional_round: 'Additional Rounds' };
        const typeLabel = TYPE_LABEL[record.payment_type] || record.payment_type;
        const amtStr = record.amount.toFixed(2);
        const activitySubject = `****${typeLabel} PAYMENT RECEIVED IN THE AMOUNT OF $${amtStr} FOR ${record.client_name}`;
        const noteContent = `<p><b>&#128179; PAYMENT RECEIVED - $${amtStr} (${typeLabel})</b></p><ul><li>Client: ${record.client_name}</li><li>Consultant: ${record.consultant_name}</li>${record.zoho_payment_id ? `<li>Zoho Payment ID: <code>${record.zoho_payment_id}</code></li>` : ''}</ul><p><i>ASAP Payment System (Zoho invoice payment).</i></p>`;
        await fetch(`https://asapcreditrepair.pipedrive.com/api/v1/notes?api_token=${PD_TOKEN2}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deal_id: parseInt(record.pipedrive_deal_id, 10), content: noteContent })
        });
        await fetch(`https://asapcreditrepair.pipedrive.com/api/v1/activities?api_token=${PD_TOKEN2}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subject: activitySubject, type: 'payment', deal_id: parseInt(record.pipedrive_deal_id, 10), done: 1, due_date: paymentDate })
        });
      } catch (e) { console.error('[payment-webhook] note/activity post failed (non-fatal):', e.message); }
    }
    // EVENT-DRIVEN VERIFY (Joe 7/30): a partial/final recorded in Zoho - via ANY
    // channel (Zapier, portal, manual entry) - triggers the credit verification
    // for that deal the moment it lands: checkbox stamped, events written,
    // metrics cache rebuilt. No waiting for syncs or nightlies.
    const vt = String(record.payment_type || '').toLowerCase();
    const vkind = (vt === 'final' || vt === 'paid_in_full') ? 'final' : (vt === 'partial' ? 'partial' : null);
    if (vkind && record.pipedrive_deal_id) {
      fetch('https://cute-cat-d9631c.netlify.app/.netlify/functions/final-credit-hook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': process.env.PIPEDRIVE_API_KEY || '' },
        body: JSON.stringify({ deal_id: record.pipedrive_deal_id, kind: vkind, source: 'zoho-payment-webhook' })
      }).then(async r => console.log(`[event-verify ${vkind}] deal ${record.pipedrive_deal_id}:`, JSON.stringify(await r.json().catch(() => ({}))).slice(0, 150)))
        .catch(e => console.error('[event-verify] failed:', e.message));
    }
    
    return { statusCode: 200, headers, body: JSON.stringify({ 
      success: true, 
      message: `Payment recorded: ${record.client_name} $${record.amount} (${record.payment_type})`,
      month: paymentMonth
    })};
  } catch (error) {
    console.error('Payment webhook error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};
