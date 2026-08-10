// crm-person-merge.js - duplicate person merge (CRM migration, Joe 8/10).
// Leadership-only. Uses Pipedrive's NATIVE merge (duplicate is merged into the
// survivor; PD moves all deals/notes/activities itself, identical to merging in
// PD's UI), then realigns the mirror: duplicate marked deleted, its child rows
// repointed to the survivor, survivor re-pulled fresh.
const PD = process.env.PIPEDRIVE_API_KEY;
const SU = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SK = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: SK, Authorization: `Bearer ${SK}`, 'Content-Type': 'application/json' };
const PF = { current_status: '612856f2221d04679c1809eadb77b30300936445', update_status: '6381d902f9c164217fbb0b5a6b98f10f1bce7fad', quick_buttons: '928261a2cb90f4c404d6b7ab89a5542d8561350c' };
const respond = (c, b) => ({ statusCode: c, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
const primary = (arr) => Array.isArray(arr) ? ((arr.find(x => x.primary) || arr[0] || {}).value || null) : (arr || null);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return respond(405, { error: 'POST only' });
  try {
    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    if (!authHeader.startsWith('Bearer ')) return respond(401, { error: 'no session' });
    const uRes = await fetch(`${SU}/auth/v1/user`, { headers: { apikey: SK, Authorization: authHeader } });
    if (!uRes.ok) return respond(401, { error: 'invalid session' });
    const authUser = await uRes.json();
    const prof = await fetch(`${SU}/rest/v1/users?email=eq.${encodeURIComponent(authUser.email)}&select=department`, { headers: H }).then(r => r.json());
    const dept = ((prof && prof[0] && prof[0].department) || '').toLowerCase();
    if (!['leadership', 'admin'].includes(dept)) return respond(403, { error: 'leadership only' });
    const body = JSON.parse(event.body || '{}');
    const survivorId = parseInt(body.survivor_id), duplicateId = parseInt(body.duplicate_id);
    if (!survivorId || !duplicateId || survivorId === duplicateId) return respond(400, { error: 'survivor_id and duplicate_id required (different)' });
    // 1) Pipedrive's native merge: duplicate INTO survivor
    const pdRes = await fetch(`https://api.pipedrive.com/v1/persons/${duplicateId}/merge?api_token=${PD}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ merge_with_id: survivorId }) });
    const pdJson = await pdRes.json().catch(() => ({}));
    if (!pdJson.success) return respond(502, { error: `Pipedrive merge: ${pdJson.error || pdRes.status}` });
    // 2) realign the mirror
    const now = new Date().toISOString();
    await fetch(`${SU}/rest/v1/crm_clients?pipedrive_person_id=eq.${duplicateId}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify({ deleted: true, synced_at: now }) });
    for (const t of ['crm_deals', 'crm_notes', 'crm_activities', 'crm_rounds']) {
      await fetch(`${SU}/rest/v1/${t}?pipedrive_person_id=eq.${duplicateId}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify({ pipedrive_person_id: survivorId, synced_at: now }) }).catch(() => {});
    }
    // 3) survivor re-pulled fresh (merge can change email/phone on the survivor)
    try {
      const pj = await fetch(`https://api.pipedrive.com/v1/persons/${survivorId}?api_token=${PD}`).then(r => r.json());
      if (pj.success && pj.data) {
        const p = pj.data;
        await fetch(`${SU}/rest/v1/crm_clients?pipedrive_person_id=eq.${survivorId}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify({
          name: p.name, email: primary(p.email), phone: primary(p.phone),
          current_status: p[PF.current_status] ? parseInt(p[PF.current_status]) : null,
          update_status: p[PF.update_status] ? parseInt(p[PF.update_status]) : null,
          quick_buttons: p[PF.quick_buttons] ? parseInt(p[PF.quick_buttons]) : null,
          pd_update_time: p.update_time || null, synced_at: now
        }) });
      }
    } catch (_) {}
    return respond(200, { ok: true, survivor_id: survivorId, merged: duplicateId, by: authUser.email });
  } catch (e) { return respond(500, { error: e.message }); }
};
