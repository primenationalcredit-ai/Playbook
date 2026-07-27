// netlify/functions/ar-tracker.js  (PLAYBOOK side)
// Proxy to the payment processor's AR endpoints using AR_INTERNAL_API_KEY.
// GET                       -> offers list (ar-offers-list)
// POST {action:'confirm_zelle', deal_id}        -> ar-zelle-confirm
// POST {action:'send_offer', deal_id}           -> ar-offer (skip_status_update)
const AR_KEY = process.env.AR_INTERNAL_API_KEY;
const PROCESSOR = process.env.PROCESSOR_BASE_URL || 'https://asap-payment-processor.netlify.app';
const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
const respond = (c, b) => ({ statusCode: c, headers, body: JSON.stringify(b) });

exports.handler = async (event) => {
  if (!AR_KEY) return respond(500, { error: 'AR_INTERNAL_API_KEY not configured on this site' });
  try {
    if (event.httpMethod === 'GET') {
      const r = await fetch(`${PROCESSOR}/.netlify/functions/ar-offers-list`, { headers: { 'X-API-Key': AR_KEY } });
      return respond(r.status, await r.json().catch(() => ({ error: 'bad response' })));
    }
    if (event.httpMethod === 'POST') {
      let body;
      try { body = JSON.parse(event.body || '{}'); } catch { return respond(400, { error: 'Invalid JSON' }); }
      const dealId = String(body.deal_id || '').trim();
      if (!dealId) return respond(400, { error: 'Missing deal_id' });
      if (body.action === 'confirm_zelle') {
        const r = await fetch(`${PROCESSOR}/.netlify/functions/ar-zelle-confirm`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Key': AR_KEY },
          body: JSON.stringify({ deal_id: dealId, conf: body.conf || undefined })
        });
        return respond(r.status, await r.json().catch(() => ({ error: 'bad response' })));
      }
      if (body.action === 'send_offer') {
        const r = await fetch(`${PROCESSOR}/.netlify/functions/ar-offer`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Key': AR_KEY },
          body: JSON.stringify({ deal_id: dealId, skip_status_update: true, force: body.force === true })
        });
        return respond(r.status, await r.json().catch(() => ({ error: 'bad response' })));
      }
      return respond(400, { error: 'Unknown action' });
    }
    return respond(405, { error: 'GET or POST only' });
  } catch (err) {
    return respond(500, { error: err.message });
  }
};
