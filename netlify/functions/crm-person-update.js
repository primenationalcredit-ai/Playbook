// crm-person-update.js - status write-back (CRM migration, Joe 8/10).
// Updates CURRENT STATUS / UPDATE STATUS / QUICK BUTTONS on a person:
// Pipedrive FIRST (so the existing Zapier/pointscrm automation swarm fires
// exactly as if edited in PD), then mirrors into crm_clients instantly.
// Auth = the user's own Playbook session token. Only these three fields.
const PD = process.env.PIPEDRIVE_API_KEY;
const SU = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SK = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: SK, Authorization: `Bearer ${SK}`, 'Content-Type': 'application/json' };
const FIELD_HASH = {
  current_status: '612856f2221d04679c1809eadb77b30300936445',
  update_status: '6381d902f9c164217fbb0b5a6b98f10f1bce7fad',
  quick_buttons: '928261a2cb90f4c404d6b7ab89a5542d8561350c'
};
const respond = (c, b) => ({ statusCode: c, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return respond(405, { error: 'POST only' });
  try {
    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    if (!authHeader.startsWith('Bearer ')) return respond(401, { error: 'no session' });
    const uRes = await fetch(`${SU}/auth/v1/user`, { headers: { apikey: SK, Authorization: authHeader } });
    if (!uRes.ok) return respond(401, { error: 'invalid session' });
    const authUser = await uRes.json();
    const body = JSON.parse(event.body || '{}');
    const personId = parseInt(body.person_id);
    if (!personId) return respond(400, { error: 'person_id required' });
    const pdPayload = {}, mirror = {};
    for (const f of Object.keys(FIELD_HASH)) {
      if (body[f] !== undefined && body[f] !== null && body[f] !== '') {
        const v = parseInt(body[f]);
        if (!Number.isFinite(v)) return respond(400, { error: `${f} must be an option id` });
        pdPayload[FIELD_HASH[f]] = v; mirror[f] = v;
      }
    }
    if (!Object.keys(pdPayload).length) return respond(400, { error: 'no fields to update' });
    // 1) Pipedrive first - the master; its automations fire off this change
    const pdRes = await fetch(`https://api.pipedrive.com/v1/persons/${personId}?api_token=${PD}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pdPayload) });
    const pdJson = await pdRes.json().catch(() => ({}));
    if (!pdJson.success) return respond(502, { error: `Pipedrive: ${pdJson.error || pdRes.status}` });
    // 2) mirror instantly (webhook also catches it; this makes the UI truthful now)
    mirror.synced_at = new Date().toISOString();
    if (pdJson.data && pdJson.data.update_time) mirror.pd_update_time = pdJson.data.update_time;
    await fetch(`${SU}/rest/v1/crm_clients?pipedrive_person_id=eq.${personId}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(mirror) });
    return respond(200, { ok: true, updated: Object.keys(mirror).filter(k => k in FIELD_HASH ? true : false), by: authUser.email });
  } catch (e) { return respond(500, { error: e.message }); }
};
