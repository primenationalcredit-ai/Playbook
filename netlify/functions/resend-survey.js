// resend-survey.js (Playbook)
// Resends the Round 2 survey to a client from an existing survey_sends row.
// POST { send_id }  ->  looks up the original send, re-sends via the payment-processor
// sender, and logs a new survey_sends row (source 'resend').

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SENDER_URL = process.env.SURVEY_SENDER_URL || 'https://asap-payment-processor.netlify.app/.netlify/functions/send-round2-survey';

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
const supa = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  try {
    const { send_id } = JSON.parse(event.body || '{}');
    if (!send_id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'send_id required' }) };

    const lookup = await fetch(`${SUPABASE_URL}/rest/v1/survey_sends?id=eq.${send_id}&select=*`, { headers: supa });
    const rows = lookup.ok ? await lookup.json() : [];
    const orig = rows[0];
    if (!orig) return { statusCode: 404, headers, body: JSON.stringify({ error: 'send not found' }) };
    if (!orig.client_email && !orig.client_phone) return { statusCode: 400, headers, body: JSON.stringify({ error: 'no email or phone on record for this client' }) };

    const payload = { name: orig.client_name, email: orig.client_email, phone: orig.client_phone, am: orig.am_name, person_id: orig.person_id, deal_id: orig.deal_id };
    let emailResult = null, smsResult = null;
    try {
      const sres = await fetch(SENDER_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const sjson = await sres.json().catch(() => ({}));
      emailResult = sjson.email || null; smsResult = sjson.sms || null;
    } catch (e) { emailResult = 'error: ' + e.message; }

    await fetch(`${SUPABASE_URL}/rest/v1/survey_sends`, {
      method: 'POST', headers: { ...supa, Prefer: 'return=minimal' },
      body: JSON.stringify({ person_id: orig.person_id, deal_id: orig.deal_id, client_name: orig.client_name, client_email: orig.client_email, client_phone: orig.client_phone, am_name: orig.am_name, survey_type: 'round2_am', source: 'resend', email_result: emailResult, sms_result: smsResult }),
    });

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, email: emailResult, sms: smsResult }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
