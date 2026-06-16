// send-round2-survey.js
// Sends the Round 2 survey link to a client by email (Outlook/Graph) and/or SMS
// (RingCentral). Uses the same env vars as the autobilling project:
//   OUTLOOK_TENANT_ID, OUTLOOK_CLIENT_ID, OUTLOOK_CLIENT_SECRET, OUTLOOK_SEND_FROM, OUTLOOK_FROM_NAME
//   RINGCENTRAL_CLIENT_ID, RINGCENTRAL_CLIENT_SECRET, RINGCENTRAL_JWT_TOKEN, RINGCENTRAL_SERVER_URL, RINGCENTRAL_FROM_NUMBER
//
// POST body: { name, email, phone, am, person_id, deal_id, channels? }
//   channels optional: e.g. ["email","sms"] (defaults to whatever contact info is present)

const SURVEY_BASE = process.env.SURVEY_BASE_URL || 'https://cute-cat-d9631c.netlify.app/survey/round2';

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };

function buildLink({ name, email, phone, am, person_id, deal_id }) {
  const q = new URLSearchParams();
  if (name) q.set('name', name);
  if (email) q.set('email', email);
  if (phone) q.set('phone', phone);
  if (am) q.set('am', am);
  if (person_id) q.set('person_id', person_id);
  if (deal_id) q.set('deal_id', deal_id);
  return `${SURVEY_BASE}?${q.toString()}`;
}

async function getOutlookToken() {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.OUTLOOK_CLIENT_ID,
    client_secret: process.env.OUTLOOK_CLIENT_SECRET,
    scope: 'https://graph.microsoft.com/.default',
  });
  const res = await fetch(`https://login.microsoftonline.com/${process.env.OUTLOOK_TENANT_ID}/oauth2/v2.0/token`, { method: 'POST', body });
  const data = await res.json();
  if (!data.access_token) throw new Error('Outlook token failed: ' + JSON.stringify(data));
  return data.access_token;
}

async function sendEmail({ to, name, link }) {
  const token = await getOutlookToken();
  const from = process.env.OUTLOOK_SEND_FROM;
  const html = `
    <div style="font-family:Arial,sans-serif;font-size:15px;color:#1e293b;line-height:1.5">
      <p>Hi ${name || 'there'},</p>
      <p>Thanks for being a client of ASAP Credit &amp; Financial Services. You are a couple of rounds in, and we want to make sure everything is going the way it should.</p>
      <p>Could you take under a minute to tell us how we are doing?</p>
      <p style="margin:24px 0">
        <a href="${link}" style="background:#002D61;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold">Take the quick survey</a>
      </p>
      <p>Thank you,<br/>ASAP Credit &amp; Financial Services</p>
    </div>`;
  const res = await fetch(`https://graph.microsoft.com/v1.0/users/${from}/sendMail`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        subject: 'How are we doing so far?',
        body: { contentType: 'HTML', content: html },
        toRecipients: [{ emailAddress: { address: to } }],
      },
      saveToSentItems: false,
    }),
  });
  if (!res.ok && res.status !== 202) { const t = await res.text(); throw new Error('Email send failed: ' + t); }
  return true;
}

async function getRingToken() {
  const basic = Buffer.from(`${process.env.RINGCENTRAL_CLIENT_ID}:${process.env.RINGCENTRAL_CLIENT_SECRET}`).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: process.env.RINGCENTRAL_JWT_TOKEN,
  });
  const res = await fetch(`${process.env.RINGCENTRAL_SERVER_URL}/restapi/oauth/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('RingCentral token failed: ' + JSON.stringify(data));
  return data.access_token;
}

async function sendSMS({ to, name, link }) {
  const token = await getRingToken();
  const text = `Hi ${name || ''}, thanks for being an ASAP client. How are we doing so far? It takes under a minute: ${link}`.trim();
  const res = await fetch(`${process.env.RINGCENTRAL_SERVER_URL}/restapi/v1.0/account/~/extension/~/sms`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: { phoneNumber: process.env.RINGCENTRAL_FROM_NUMBER }, to: [{ phoneNumber: to }], text }),
  });
  if (!res.ok) { const t = await res.text(); throw new Error('SMS send failed: ' + t); }
  return true;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  try {
    const input = event.httpMethod === 'POST' ? JSON.parse(event.body || '{}') : (event.queryStringParameters || {});
    const { name, email, phone, am, person_id, deal_id } = input;
    if (!email && !phone) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Need an email or phone to send to.' }) };

    const link = buildLink({ name, email, phone, am, person_id, deal_id });
    const wantEmail = (!input.channels || input.channels.includes('email')) && email;
    const wantSMS = (!input.channels || input.channels.includes('sms')) && phone;

    const out = { link, email: null, sms: null };
    if (wantEmail) { try { await sendEmail({ to: email, name, link }); out.email = 'sent'; } catch (e) { out.email = 'error: ' + e.message; } }
    if (wantSMS) { try { await sendSMS({ to: phone, name, link }); out.sms = 'sent'; } catch (e) { out.sms = 'error: ' + e.message; } }

    return { statusCode: 200, headers, body: JSON.stringify(out) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
