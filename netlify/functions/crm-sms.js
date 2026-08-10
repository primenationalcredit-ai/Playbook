// crm-sms.js - Playbook gateway to the processor SMS relay (Joe 8/10, Phase 3).
// Verifies the user's OWN Playbook session, then forwards to crm-sms-relay
// with the internal key - which never reaches any browser.
//   GET  ?phone=...            -> the SMS thread with that number
//   POST {phone, text}         -> send from the A2P number (sender name appended)
const SU = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SK = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const RELAY = 'https://asap-payment-processor.netlify.app/.netlify/functions/crm-sms-relay';
const IKEY = process.env.PROCESSOR_INTERNAL_API_KEY || 'LmxMO6Ua81Q7qtvVHoNhsriGyTYud2lKepRjAP9wkbc5ZJD3';
const respond = (c, b) => ({ statusCode: c, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });

exports.handler = async (event) => {
  try {
    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    if (!authHeader.startsWith('Bearer ')) return respond(401, { error: 'no session' });
    const uRes = await fetch(`${SU}/auth/v1/user`, { headers: { apikey: SK, Authorization: authHeader } });
    if (!uRes.ok) return respond(401, { error: 'invalid session' });
    const authUser = await uRes.json();
    if (event.httpMethod === 'GET') {
      const phone = (event.queryStringParameters || {}).phone;
      if (!phone) return respond(400, { error: 'phone required' });
      const r = await fetch(`${RELAY}?key=${IKEY}&action=list&phone=${encodeURIComponent(phone)}`);
      return respond(r.status, await r.json());
    }
    if (event.httpMethod === 'POST') {
      const b = JSON.parse(event.body || '{}');
      let sender = authUser.email || '';
      try {
        const prof = await fetch(`${SU}/rest/v1/users?email=eq.${encodeURIComponent(authUser.email)}&select=name`, { headers: { apikey: SK, Authorization: `Bearer ${SK}` } }).then(r => r.json());
        if (Array.isArray(prof) && prof[0] && prof[0].name) sender = prof[0].name.split(' ')[0];
      } catch (_) {}
      const text = (b.text || '').trim();
      if (!text) return respond(400, { error: 'text required' });
      const r = await fetch(`${RELAY}?key=${IKEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', phone: b.phone, text: `${text}\n- ${sender}, ASAP Credit Repair` })
      });
      return respond(r.status, await r.json());
    }
    return respond(405, { error: 'GET or POST' });
  } catch (e) { return respond(500, { error: e.message }); }
};
