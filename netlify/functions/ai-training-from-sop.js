// ai-training-from-sop.js - TRAINING BUILDER (Joe 8/13). Turns an APPROVED SOP into
// a real training course: modules, lessons, and a scenario quiz - so approving an SOP
// and having trainable, testable material stop being two separate jobs.
// The course is created UNPUBLISHED on purpose: leadership reviews and publishes it in
// the Training Portal, and publishing is what assigns it. That is the approval gate.
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
  return { id: u.id, name };
}
exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return respond(405, { error: 'POST only' });
    let body = {}; try { body = JSON.parse(event.body || '{}'); } catch (e) {}
    const who = await requireLeader(event);
    if (!who) return respond(403, { error: 'leadership session required' });
    if (body.action === 'status' && body.nonce) {
      const rows = await fetch(`${SU}/rest/v1/app_cache?cache_key=eq.${encodeURIComponent('trn_' + body.nonce)}&select=cache_value`, { headers: H }).then(r => r.json());
      if (!Array.isArray(rows) || !rows.length) return respond(200, { status: 'unknown' });
      let v = {}; try { v = JSON.parse(rows[0].cache_value); } catch (e) {}
      return respond(200, v);
    }
    if (body.action === 'start' && body.card_id) {
      const rows = await fetch(`${SU}/rest/v1/project_cards?id=eq.${encodeURIComponent(body.card_id)}&select=links`, { headers: H }).then(r => r.json());
      const links = (Array.isArray(rows) && rows[0] && Array.isArray(rows[0].links)) ? rows[0].links : [];
      const sops = links.filter(l => l && l.sop && l.content);
      if (!sops.length) return respond(200, { warn: 'This project has no approved SOP yet. Generate and approve an SOP first - the training is built from it.' });
      const nonce = Math.random().toString(36).slice(2, 12);
      await fetch(`${SU}/rest/v1/app_cache`, { method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({ cache_key: 'trn_' + nonce, cache_value: JSON.stringify({ status: 'building' }), updated_at: new Date().toISOString() }) });
      fetch(`${SITE}/.netlify/functions/ai-training-background`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nonce, key: BKEY, card_id: body.card_id, created_by: who.id }) }).catch(() => {});
      return respond(200, { nonce });
    }
    return respond(400, { error: 'unknown action' });
  } catch (e) { return respond(500, { error: e.message }); }
};
