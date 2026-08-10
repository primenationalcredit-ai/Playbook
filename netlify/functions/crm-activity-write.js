// crm-activity-write.js - activities write-back (CRM migration, Joe 8/10).
// Two actions from the Client File: create a task/activity, or mark one done.
// Pipedrive FIRST (its automations + everyone still in PD see it natively),
// then instant crm_activities mirror. Auth = the user's own Playbook session.
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

    if (body.action === 'complete') {
      const actId = parseInt(body.activity_id);
      if (!actId) return respond(400, { error: 'activity_id required' });
      const pdRes = await fetch(`https://api.pipedrive.com/v1/activities/${actId}?api_token=${PD}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ done: true }) });
      const pdJson = await pdRes.json().catch(() => ({}));
      if (!pdJson.success) return respond(502, { error: `Pipedrive: ${pdJson.error || pdRes.status}` });
      await fetch(`${SU}/rest/v1/crm_activities?pipedrive_activity_id=eq.${actId}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify({ done: true, done_time: new Date().toISOString(), synced_at: new Date().toISOString() }) });
      return respond(200, { ok: true, completed: actId });
    }

    // default action: create
    const subject = (body.subject || '').trim();
    const personId = parseInt(body.person_id) || null;
    const dealId = parseInt(body.deal_id) || null;
    if (!subject) return respond(400, { error: 'subject required' });
    if (!personId && !dealId) return respond(400, { error: 'person_id or deal_id required' });
    const pdPayload = { subject, type: body.type || 'task', note: body.note ? `${body.note} - ${author} (via Playbook)` : `- ${author} (via Playbook)` };
    if (body.due_date) pdPayload.due_date = body.due_date;
    if (dealId) pdPayload.deal_id = dealId;
    if (personId) pdPayload.person_id = personId;
    const pdRes = await fetch(`https://api.pipedrive.com/v1/activities?api_token=${PD}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pdPayload) });
    const pdJson = await pdRes.json().catch(() => ({}));
    if (!pdJson.success) return respond(502, { error: `Pipedrive: ${pdJson.error || pdRes.status}` });
    const a = pdJson.data;
    await fetch(`${SU}/rest/v1/crm_activities?on_conflict=pipedrive_activity_id`, {
      method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ pipedrive_activity_id: a.id, pipedrive_deal_id: dealId, pipedrive_person_id: personId, subject, activity_type: pdPayload.type, done: false, due_date: body.due_date || null, note: pdPayload.note, owner_name: author, source: 'playbook', pd_add_time: a.add_time || new Date().toISOString(), pd_update_time: a.update_time || null, synced_at: new Date().toISOString() }])
    });
    return respond(200, { ok: true, activity_id: a.id, author });
  } catch (e) { return respond(500, { error: e.message }); }
};
