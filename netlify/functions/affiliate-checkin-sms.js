// affiliate-checkin-sms.js  (Playbook)
// POST { id, consultant } -> sends the voicemail follow-up text to the affiliate,
// logs the touch, and appends the line to Pipedrive Additional F/U Notes.
// Fired by the Call Queue when a consultant logs "Left voicemail" with the text option on.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
let RC_CLIENT_ID = process.env.RINGCENTRAL_CLIENT_ID || process.env.RC_CLIENT_ID;
let RC_CLIENT_SECRET = process.env.RINGCENTRAL_CLIENT_SECRET || process.env.RC_CLIENT_SECRET;
let RC_JWT = process.env.RINGCENTRAL_JWT || process.env.RC_JWT;
let RC_FROM = process.env.RINGCENTRAL_FROM_NUMBER || process.env.RC_FROM_NUMBER;

async function loadRcSecrets() {
  if (RC_CLIENT_ID && RC_CLIENT_SECRET && RC_JWT && RC_FROM) return;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_secrets?key=in.(rc_client_id,rc_client_secret,rc_jwt,rc_from_number)&select=key,value`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    const rows = r.ok ? await r.json() : [];
    const m = {}; rows.forEach((x) => { m[x.key] = x.value; });
    RC_CLIENT_ID = RC_CLIENT_ID || m.rc_client_id;
    RC_CLIENT_SECRET = RC_CLIENT_SECRET || m.rc_client_secret;
    RC_JWT = RC_JWT || m.rc_jwt;
    RC_FROM = RC_FROM || m.rc_from_number;
  } catch (e) { /* surfaced by the send attempt */ }
}
const PIPEDRIVE_TOKEN = process.env.PIPEDRIVE_API_KEY;
const PIPEDRIVE_DOMAIN = process.env.PIPEDRIVE_DOMAIN || 'asapcreditrepairusa';
const PD_FU_NOTES_KEY = '17c6fcd0a8bcc21bbba680a8fe82697d9f996df9';

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };

async function supa(path, opts = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', ...(opts.headers || {}) }
  });
  if (opts.method === 'POST' || opts.method === 'PATCH') return r.ok;
  return r.ok ? r.json() : [];
}

function firstName(name) { return String(name || '').trim().split(/\s+/)[0] || 'there'; }

async function rcToken() {
  const r = await fetch('https://platform.ringcentral.com/restapi/oauth/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${RC_CLIENT_ID}:${RC_CLIENT_SECRET}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: RC_JWT })
  });
  if (!r.ok) throw new Error(`rc auth ${r.status}`);
  return (await r.json()).access_token;
}

async function appendPdNote(orgId, line) {
  if (!PIPEDRIVE_TOKEN || !orgId) return;
  try {
    const base = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/organizations/${orgId}`;
    const g = await fetch(`${base}?api_token=${PIPEDRIVE_TOKEN}`);
    const gd = await g.json();
    const existing = (gd && gd.data && gd.data[PD_FU_NOTES_KEY]) ? String(gd.data[PD_FU_NOTES_KEY]) : '';
    let combined = (existing ? existing + '\n' : '') + line;
    if (combined.length > 3500) combined = combined.slice(combined.length - 3500);
    await fetch(`${base}?api_token=${PIPEDRIVE_TOKEN}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [PD_FU_NOTES_KEY]: combined })
    });
    await supa(`affiliate_orgs?pipedrive_org_id=eq.${orgId}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ pipedrive_fu_notes: combined }) });
  } catch (e) { /* non-blocking */ }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
  try {
    const { id, consultant } = JSON.parse(event.body || '{}');
    if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'missing id' }) };
    const aff = (await supa(`affiliate_orgs?id=eq.${id}&select=*`))[0];
    if (!aff) return { statusCode: 404, headers, body: JSON.stringify({ error: 'affiliate not found' }) };
    if (!aff.contact_phone) return { statusCode: 200, headers, body: JSON.stringify({ success: false, error: 'no phone on file' }) };
    if (aff.opted_out) return { statusCode: 200, headers, body: JSON.stringify({ success: false, error: 'opted out' }) };

    await loadRcSecrets();
    const who = firstName(consultant || aff.owner_name || '') || 'your ASAP team';
    const msg = `Hey ${firstName(aff.contact_name || aff.org_name)}, it is ${who} with ASAP Credit & Financial Services. Just left you a voicemail, was calling to check in and see how things are going on your end. Nothing urgent, feel free to reply here anytime. (Reply STOP to opt out)`;

    const token = await rcToken();
    const digits = String(aff.contact_phone).replace(/[^\d+]/g, '');
    const to = digits.startsWith('+') ? digits : `+1${digits}`;
    const sms = await fetch('https://platform.ringcentral.com/restapi/v1.0/account/~/extension/~/sms', {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: { phoneNumber: RC_FROM }, to: [{ phoneNumber: to }], text: msg })
    });
    if (!sms.ok) return { statusCode: 502, headers, body: JSON.stringify({ error: `ringcentral ${sms.status}` }) };

    const todayCT = new Date().toLocaleDateString('en-US', { timeZone: 'America/Chicago' });
    await supa('affiliate_touches', {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify([{
        affiliate_org_id: aff.id, pipedrive_org_id: aff.pipedrive_org_id, channel: 'sms',
        segment: aff.segment, step_number: aff.cadence_step || 0, subject: 'Voicemail follow-up text',
        status: 'sent', detail: 'voicemail_followup'
      }])
    });
    await appendPdNote(aff.pipedrive_org_id, `${todayCT}: Voicemail follow-up text sent by ${who} (ASAP outreach)`);

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: String(e.message || e).slice(0, 300) }) };
  }
};
