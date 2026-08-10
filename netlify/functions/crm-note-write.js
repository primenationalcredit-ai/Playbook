// crm-note-write.js - FIRST WRITE-BACK of the CRM migration (Joe 8/10).
// Posts a note from the Client File: writes to Pipedrive (still the master)
// AND mirrors into crm_notes immediately (source=playbook). Auth = the user's
// own Playbook session token, verified against Supabase; author = their name.
const PD = process.env.PIPEDRIVE_API_KEY;
const SU = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SK = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: SK, Authorization: `Bearer ${SK}`, 'Content-Type': 'application/json' };
const respond = (c, b) => ({ statusCode: c, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return respond(405, { error: 'POST only' });
  try {
    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    if (!authHeader.startsWith('Bearer ')) return respond(401, { error: 'no session' });
    const uRes = await fetch(`${SU}/auth/v1/user`, { headers: { apikey: SK, Authorization: authHeader } });
    if (!uRes.ok) return respond(401, { error: 'invalid session' });
    const authUser = await uRes.json();
    let author = authUser.email || 'Playbook user';
    try {
      const prof = await fetch(`${SU}/rest/v1/users?email=eq.${encodeURIComponent(authUser.email)}&select=name`, { headers: H }).then(r => r.json());
      if (Array.isArray(prof) && prof[0] && prof[0].name) author = prof[0].name;
    } catch (_) {}
    const body = JSON.parse(event.body || '{}');
    const content = (body.content || '').trim();
    const personId = parseInt(body.person_id) || null;
    const dealId = parseInt(body.deal_id) || null;
    if (!content) return respond(400, { error: 'content required' });
    if (!personId && !dealId) return respond(400, { error: 'person_id or deal_id required' });
    // 1) Pipedrive first (still the master until cutover)
    const pdPayload = { content: `${content}\n\n- ${author} (via Playbook)` };
    if (dealId) pdPayload.deal_id = dealId;
    if (personId) pdPayload.person_id = personId;
    const pdRes = await fetch(`https://api.pipedrive.com/v1/notes?api_token=${PD}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pdPayload) });
    const pdJson = await pdRes.json().catch(() => ({}));
    if (!pdJson.success) return respond(502, { error: `Pipedrive: ${pdJson.error || pdRes.status}` });
    const n = pdJson.data;
    // 2) mirror immediately (webhook would also catch it; this makes it instant + idempotent)
    await fetch(`${SU}/rest/v1/crm_notes?on_conflict=pipedrive_note_id`, {
      method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ pipedrive_note_id: n.id, pipedrive_deal_id: dealId, pipedrive_person_id: personId, content: pdPayload.content, pinned: false, source: 'playbook', author, pd_add_time: n.add_time || new Date().toISOString(), pd_update_time: n.update_time || null, synced_at: new Date().toISOString() }])
    });
    return respond(200, { ok: true, note_id: n.id, author });
  } catch (e) { return respond(500, { error: e.message }); }
};
