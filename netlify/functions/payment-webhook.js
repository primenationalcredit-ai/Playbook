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
    const body = JSON.parse(event.body || '{}');
    
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
