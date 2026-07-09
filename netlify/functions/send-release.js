// send-release.js  (Playbook)
// Proxy between the Refund Tracking queue and the processor's create-release.
// Exists so the browser NEVER holds the API key: this function verifies the
// caller is leadership and the request is awaiting_signature, then calls the
// processor with PAYMENT_API_KEY from the server environment.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PAYMENT_API_KEY = process.env.PAYMENT_API_KEY;
const PROCESSOR_URL = process.env.PROCESSOR_URL || 'https://asap-payment-processor.netlify.app';

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
const respond = (statusCode, body) => ({ statusCode, headers, body: JSON.stringify(body) });

async function supa(path, opts = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', ...(opts.headers || {}) }
  });
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch (e) {}
  return { ok: r.ok, json, text };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return respond(200, {});
  if (event.httpMethod !== 'POST') return respond(405, { error: 'POST only' });
  let b = {}; try { b = JSON.parse(event.body || '{}'); } catch (e) {}
  if (!b.request_id) return respond(400, { error: 'request_id required' });

  // Leadership check (server-side, same rule as decide)
  const lead = await supa(`users?email=eq.${encodeURIComponent(String(b.requested_by || '').trim().toLowerCase())}&department=eq.leadership&select=id`);
  if (!Array.isArray(lead.json) || lead.json.length === 0) {
    return respond(403, { error: 'Only leadership can send releases' });
  }

  const rows = await supa(`refund_requests?id=eq.${b.request_id}&select=*`);
  const req = (rows.json || [])[0];
  if (!req) return respond(404, { error: 'Request not found' });
  if (req.status !== 'awaiting_signature') {
    return respond(409, { error: `Request is ${req.status} - releases are sent only for awaiting-signature requests` });
  }
  if (!req.client_email && !req.client_phone) {
    return respond(400, { error: 'Request has no client email or phone - add contact info to the request first' });
  }

  try {
    const r = await fetch(`${PROCESSOR_URL}/.netlify/functions/create-release`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': PAYMENT_API_KEY || '' },
      body: JSON.stringify({
        refund_request_id: req.id,
        pipedrive_deal_id: req.pipedrive_deal_id,
        client_name: req.client_name,
        client_email: req.client_email,
        client_phone: req.client_phone,
        amount: req.amount
      })
    });
    const d = await r.json();
    if (!r.ok || d.error) return respond(502, { error: d.error || 'create-release failed' });

    // Record the release id on the request
    if (d.release_id) {
      await supa(`refund_requests?id=eq.${req.id}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ release_agreement_id: d.release_id })
      });
    }
    return respond(200, { success: true, email_sent: d.email_sent, sms_sent: d.sms_sent, signing_url: d.signing_url });
  } catch (e) {
    return respond(500, { error: String(e.message || e).slice(0, 200) });
  }
};
