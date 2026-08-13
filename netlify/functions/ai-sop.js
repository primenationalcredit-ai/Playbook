// ai-sop.js - PHASE C of the AI Project Manager (Joe 8/13). In-Playbook SOPs.
// POST Authorization: Bearer <session>. Actions:
//   {action:'start', card_id} -> kicks background generator, returns {nonce}
//   {action:'status', nonce} -> {status: generating|done|error, draft?}
//   {action:'approve', card_id, content} -> stores SOP v{n} on card links + Updates line
const SU = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SK = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const BKEY = process.env.PAYMENT_API_KEY || process.env.PIPEDRIVE_API_KEY || '';
const SITE = process.env.URL || 'https://cute-cat-d9631c.netlify.app';
const H = { apikey: SK, Authorization: `Bearer ${SK}`, 'Content-Type': 'application/json' };
const respond = (c, b) => ({ statusCode: c, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
async function requireLeader(event) {
  const tok = (event.headers?.authorization || event.headers?.Authorization || '').replace(/^Bearer\s+/i, '');
  if (!tok) return null;
  const uRes = await fetch(`${SU}/auth/v1/user`, { headers: { apikey: SK, Authorization: `Bearer ${tok}` } });
  if (!uRes.ok) return null;
  const u = await uRes.json().catch(() => null);
  if (!u || !u.id) return null;
  let name = u.email || 'leadership';
  try {
    let rows = await fetch(`${SU}/rest/v1/users?select=role,name,email&id=eq.${encodeURIComponent(u.id)}`, { headers: H }).then(r => r.json());
    if (!Array.isArray(rows) || !rows.length) rows = await fetch(`${SU}/rest/v1/users?select=role,name,email&email=eq.${encodeURIComponent(u.email || '')}`, { headers: H }).then(r => r.json());
    const row = Array.isArray(rows) && rows[0];
    if (row) { name = row.name || name; if (!/leader|admin/i.test(String(row.role || ''))) return null; }
  } catch (e) { }
  return { name };
}
exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return respond(405, { error: 'POST only' });
    let body = {}; try { body = JSON.parse(event.body || '{}'); } catch (e) {}
    const who = await requireLeader(event);
    if (!who) return respond(403, { error: 'leadership session required' });
    if (body.action === 'status' && body.nonce) {
      const rows = await fetch(`${SU}/rest/v1/app_cache?cache_key=eq.${encodeURIComponent('sop_' + body.nonce)}&select=cache_value`, { headers: H }).then(r => r.json());
      if (!Array.isArray(rows) || !rows.length) return respond(200, { status: 'unknown' });
      let v = {}; try { v = JSON.parse(rows[0].cache_value); } catch (e) {}
      return respond(200, v);
    }
    if (body.action === 'start' && body.card_id) {
      const nonce = Math.random().toString(36).slice(2, 12);
      await fetch(`${SU}/rest/v1/app_cache`, { method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({ cache_key: 'sop_' + nonce, cache_value: JSON.stringify({ status: 'generating' }), updated_at: new Date().toISOString() }) });
      fetch(`${SITE}/.netlify/functions/ai-sop-background`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nonce, key: BKEY, card_id: body.card_id }) }).catch(() => {});
      return respond(200, { nonce });
    }
    if (body.action === 'approve' && body.card_id && body.content) {
      const rows = await fetch(`${SU}/rest/v1/project_cards?id=eq.${encodeURIComponent(body.card_id)}&select=links,updates`, { headers: H }).then(r => r.json());
      if (!Array.isArray(rows) || !rows.length) return respond(404, { error: 'card not found' });
      const links = Array.isArray(rows[0].links) ? rows[0].links : [];
      const updates = Array.isArray(rows[0].updates) ? rows[0].updates : [];
      const version = links.filter(l => l && l.sop).length + 1;
      links.push({ label: `SOP v${version}`, name: `SOP v${version}`, url: '', sop: true, content: String(body.content).slice(0, 60000), approved_by: who.name, at: new Date().toISOString() });
      updates.unshift({ text: `SOP v${version} approved by ${who.name} and attached to this project.`, by: 'AI Project Manager', at: new Date().toISOString() });
      const up = await fetch(`${SU}/rest/v1/project_cards?id=eq.${encodeURIComponent(body.card_id)}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' },
        body: JSON.stringify({ links, updates, updated_at: new Date().toISOString() }) });
      if (!up.ok) return respond(500, { error: 'save failed: ' + (await up.text()).slice(0, 150) });
      return respond(200, { ok: true, version });
    }
    return respond(400, { error: 'unknown action' });
  } catch (e) { return respond(500, { error: e.message }); }
};
