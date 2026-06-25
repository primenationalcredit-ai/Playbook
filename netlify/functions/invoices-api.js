// invoices-api.js (Playbook)
// Server-side proxy to the payment processor's consultant-dashboard-api. Keeps the
// INTERNAL_API_KEY off the browser, per the cross-project auth rule (see
// PLAYBOOK_WELCOME_EMAIL_BRIEF, Part 7). The Playbook UI hits this function with
// { action, ...payload } and we forward to the payment processor.
//
// Allowed actions in v1 (read-only): get_deal, list_recent_invoices.
// To enable write actions later (refund/date-change/pause), add them to ALLOWED.

const PAYMENT_API_URL = process.env.PAYMENT_API_URL
  || 'https://asap-payment-processor.netlify.app/.netlify/functions/consultant-dashboard-api';
const PAYMENT_API_KEY = process.env.PAYMENT_API_KEY;

const ALLOWED = new Set(['get_deal', 'list_recent_invoices']);

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

  if (!PAYMENT_API_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'PAYMENT_API_KEY env var is not set on this site. Add the payment processor INTERNAL_API_KEY to Playbook Netlify env.' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid JSON body' }) }; }

  const action = body.action;
  if (!action) return { statusCode: 400, headers, body: JSON.stringify({ error: 'action required' }) };
  if (!ALLOWED.has(action)) return { statusCode: 403, headers, body: JSON.stringify({ error: `action '${action}' not allowed from Playbook. v1 is read-only.` }) };

  try {
    const upstream = await fetch(PAYMENT_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': PAYMENT_API_KEY },
      body: JSON.stringify(body)
    });
    const text = await upstream.text();
    return { statusCode: upstream.status, headers, body: text };
  } catch (err) {
    return { statusCode: 502, headers, body: JSON.stringify({ error: 'upstream call failed', detail: String(err && err.message || err) }) };
  }
};
