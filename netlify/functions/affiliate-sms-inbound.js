// netlify/functions/affiliate-sms-inbound.js
//
// Honors "Reply STOP to opt out" on affiliate texts.
// RingCentral posts inbound SMS events here; any STOP-family reply flips
// opted_out=true on the matching affiliate_orgs row and stamps the notes.
//
// Setup: create a RingCentral webhook subscription with event filter
//   /restapi/v1.0/account/~/extension/~/message-store/instant?type=SMS
// pointing at this function's URL. RingCentral's validation handshake
// (Validation-Token header echo) is handled below.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
const HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json'
};

const STOP_WORDS = ['STOP', 'STOPALL', 'STOP ALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT', 'OPTOUT', 'OPT OUT', 'REMOVE ME'];

const digits10 = (p) => String(p || '').replace(/\D/g, '').slice(-10);

exports.handler = async (event) => {
  // RingCentral subscription validation handshake: echo the token back.
  const vt = event.headers['validation-token'] || event.headers['Validation-Token'];
  if (vt) return { statusCode: 200, headers: { 'Validation-Token': vt }, body: '' };

  try {
    const payload = JSON.parse(event.body || '{}');
    // RC instant-message event shape: { body: { direction, type, subject, from: { phoneNumber }, ... } }
    const msg = payload.body || payload;
    const direction = String(msg.direction || '').toLowerCase();
    const type = String(msg.type || '').toUpperCase();
    const text = String(msg.subject || msg.text || '').trim().toUpperCase();
    const fromPhone = digits10(msg.from && (msg.from.phoneNumber || msg.from));

    if (type && type !== 'SMS') return ok('ignored: not sms');
    if (direction && direction !== 'inbound') return ok('ignored: not inbound');
    if (!fromPhone) return ok('ignored: no from number');

    const isStop = STOP_WORDS.some(w => text === w || text.startsWith(w + ' ') || text.startsWith(w + '.') || text.startsWith(w + '!'));
    if (!isStop) return ok('ignored: not a stop message');

    // Match by last-4 via ilike, then confirm on full 10 digits in code
    // (contact_phone formats vary: dashes, parens, +1).
    const last4 = fromPhone.slice(-4);
    const q = `affiliate_orgs?contact_phone=ilike.*${last4}*&select=id,org_name,contact_name,contact_phone,opted_out,pipedrive_fu_notes`;
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${q}`, { headers: HEADERS });
    const rows = r.ok ? await r.json() : [];
    const match = (rows || []).find(a => digits10(a.contact_phone) === fromPhone);

    if (!match) { console.log(`STOP from ${fromPhone}: no affiliate match`); return ok('no affiliate match'); }
    if (match.opted_out) return ok(`already opted out: ${match.org_name}`);

    const stamp = new Date().toLocaleDateString('en-US', { timeZone: 'America/Chicago' });
    const note = `${stamp} AUTO: SMS reply "${text.slice(0, 40)}" from ${fromPhone} - opted out of all outreach\n${match.pipedrive_fu_notes || ''}`.slice(0, 8000);
    const patch = await fetch(`${SUPABASE_URL}/rest/v1/affiliate_orgs?id=eq.${match.id}`, {
      method: 'PATCH', headers: HEADERS,
      body: JSON.stringify({ opted_out: true, updated_at: new Date().toISOString(), pipedrive_fu_notes: note })
    });
    if (!patch.ok) { console.error('opt-out PATCH failed:', await patch.text()); return ok('patch failed (logged)'); }

    console.log(`OPTED OUT via SMS STOP: ${match.org_name} (id ${match.id}, ${fromPhone})`);
    return ok(`opted out: ${match.org_name}`);
  } catch (e) {
    console.error('affiliate-sms-inbound error:', e);
    return ok('error (logged)'); // always 200 so RC doesn't retry-spam
  }
};

function ok(message) {
  return { statusCode: 200, body: JSON.stringify({ ok: true, message }) };
}
