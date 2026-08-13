import sys
door = """// ai-sop.js - PHASE C of the AI Project Manager (Joe 8/13). In-Playbook SOPs.
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
  const tok = (event.headers?.authorization || event.headers?.Authorization || '').replace(/^Bearer\\s+/i, '');
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
      links.push({ name: `SOP v${version}`, url: '', sop: true, content: String(body.content).slice(0, 60000), approved_by: who.name, at: new Date().toISOString() });
      updates.unshift({ text: `SOP v${version} approved by ${who.name} and attached to this project.`, by: 'AI Project Manager', at: new Date().toISOString() });
      const up = await fetch(`${SU}/rest/v1/project_cards?id=eq.${encodeURIComponent(body.card_id)}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' },
        body: JSON.stringify({ links, updates, updated_at: new Date().toISOString() }) });
      if (!up.ok) return respond(500, { error: 'save failed: ' + (await up.text()).slice(0, 150) });
      return respond(200, { ok: true, version });
    }
    return respond(400, { error: 'unknown action' });
  } catch (e) { return respond(500, { error: e.message }); }
};
"""
open('netlify/functions/ai-sop.js', 'w', encoding='utf-8', newline='').write(door)
print("ai-sop.js written")

bg = """// ai-sop-background.js - PHASE C generator (15-min background fn, BKEY-gated).
const SU = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SK = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const AK = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;
const BKEY = process.env.PAYMENT_API_KEY || process.env.PIPEDRIVE_API_KEY || '';
const H = { apikey: SK, Authorization: `Bearer ${SK}`, 'Content-Type': 'application/json' };
async function save(nonce, val) {
  await fetch(`${SU}/rest/v1/app_cache?cache_key=eq.${encodeURIComponent('sop_' + nonce)}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' },
    body: JSON.stringify({ cache_value: JSON.stringify(val), updated_at: new Date().toISOString() }) });
}
exports.handler = async (event) => {
  let nonce = null;
  try {
    const body = JSON.parse(event.body || '{}');
    nonce = body.nonce;
    if (!nonce || !BKEY || body.key !== BKEY) return { statusCode: 401, body: 'no' };
    const rows = await fetch(`${SU}/rest/v1/project_cards?id=eq.${encodeURIComponent(body.card_id)}&select=*`, { headers: H }).then(r => r.json());
    if (!Array.isArray(rows) || !rows.length) { await save(nonce, { status: 'error', error: 'card not found' }); return { statusCode: 200, body: 'err' }; }
    const card = rows[0];
    const tasks = (card.steps || []).map((st, i) => (i + 1) + '. ' + st.text + (st.assignee ? ' (owner: ' + st.assignee + ')' : '') + (st.details ? '\\n   Details: ' + String(st.details).slice(0, 800) : '') + (Array.isArray(st.subtasks) && st.subtasks.length ? '\\n   Checklist: ' + st.subtasks.map(sb => sb.text).join(' | ').slice(0, 1200) : '')).join('\\n');
    const prompt = 'Write the official Standard Operating Procedure for the completed ASAP Credit Repair project below. Employees will read it, be quizzed on it, and follow it forever - write for a brand-new employee who has never seen this feature.\\n\\nPROJECT: ' + card.title + '\\nOBJECTIVE: ' + (card.objective || '-') + '\\nNOTES/PLAN: ' + String(card.notes || '-').slice(0, 2500) + '\\nDEPENDENCIES: ' + (card.dependencies || '-') + '\\nRISKS/EDGE CASES: ' + (card.risks || '-') + '\\nTASKS BUILT (with details):\\n' + (tasks || '(none)') + '\\n\\nFORMAT (markdown): # SOP: <title>, then sections: Purpose (2-3 sentences); Who This Applies To (roles); When To Use This; Step-by-Step Procedure (numbered, concrete, per-role where relevant, written from the built tasks - describe USING the feature, not building it); Edge Cases and What To Do; FAQ (6-8 real questions a confused employee would ask, with answers); Escalation (when to ask leadership). End with the line: (SOP version and approval are recorded automatically.) No preamble, no closing commentary - the document only.';
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'x-api-key': AK, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 8000, messages: [{ role: 'user', content: prompt }] })
    });
    const data = await res.json().catch(() => ({}));
    const draft = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\\n').trim();
    if (!res.ok || !draft) { await save(nonce, { status: 'error', error: (data.error && data.error.message) || ('anthropic ' + res.status) }); return { statusCode: 200, body: 'err' }; }
    await save(nonce, { status: 'done', draft });
    return { statusCode: 200, body: 'ok' };
  } catch (e) { if (nonce) await save(nonce, { status: 'error', error: e.message }).catch(() => {}); return { statusCode: 200, body: 'err' }; }
};
"""
open('netlify/functions/ai-sop-background.js', 'w', encoding='utf-8', newline='').write(bg)
print("ai-sop-background.js written")

f = 'src/pages/LeadershipProjects.jsx'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
a1 = "with you. Ask me anything about it, or tell me what to change"
n1 = s.count(a1)
if n1 != 1: print("ABORTED panel state: anchor x" + str(n1)); sys.exit(1)
line_end = s.index("\\n", s.index(a1))
sop_logic = """
  // PHASE C (Joe 8/13): in-Playbook SOP engine - generate from the card, review, approve.
  const [sopBusy, setSopBusy] = useState(false);
  const [sopDraft, setSopDraft] = useState(null);
  const genSOP = async () => {
    if (sopBusy) return; setSopBusy(true);
    setMsgs(p => [...p, { role: 'assistant', local: true, content: 'Drafting the SOP from this project card - 30 to 60 seconds...' }]);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess && sess.session && sess.session.access_token;
      const st = await fetch('/.netlify/functions/ai-sop', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ action: 'start', card_id: card.id }) });
      const sj = await st.json();
      if (!st.ok || !sj.nonce) throw new Error(sj.error || 'start failed');
      for (let t = 0; t < 100; t++) {
        await new Promise(r => setTimeout(r, 3000));
        const pr = await fetch('/.netlify/functions/ai-sop', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ action: 'status', nonce: sj.nonce }) });
        const pj = await pr.json();
        if (pj.status === 'done') { setSopDraft(pj.draft || ''); setSopBusy(false); return; }
        if (pj.status === 'error') throw new Error(pj.error || 'generation failed');
      }
      throw new Error('timed out waiting for the draft');
    } catch (e) { setMsgs(p => [...p, { role: 'assistant', local: true, content: 'SOP draft failed: ' + e.message }]); setSopBusy(false); }
  };
  const approveSOP = async () => {
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess && sess.session && sess.session.access_token;
      const res = await fetch('/.netlify/functions/ai-sop', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ action: 'approve', card_id: card.id, content: sopDraft }) });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || 'approve failed');
      setSopDraft(null);
      setMsgs(p => [...p, { role: 'assistant', local: true, content: 'SOP v' + j.version + ' approved and attached to this project (SOP and Files section + Updates log).' }]);
      setTimeout(() => onChanged(), 800);
    } catch (e) { setMsgs(p => [...p, { role: 'assistant', local: true, content: 'SOP approve failed: ' + e.message }]); }
  };"""
s = s[:line_end] + sop_logic + s[line_end:]
a2 = "AI Project Manager</div>"
n2 = s.count(a2)
if n2 != 1: print("ABORTED panel header: anchor x" + str(n2)); sys.exit(1)
b2 = a2 + """
        <button onClick={genSOP} disabled={sopBusy} className="ml-auto mr-2 px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-semibold disabled:opacity-50">{sopBusy ? 'Drafting...' : 'Generate SOP'}</button>
        {sopDraft !== null && (
          <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col" style={{ height: '85vh' }}>
              <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
                <div className="font-bold text-slate-800">SOP draft - review, edit, approve</div>
                <button onClick={() => setSopDraft(null)} className="text-slate-400 hover:text-slate-600 text-lg leading-none">X</button>
              </div>
              <textarea value={sopDraft} onChange={(e) => setSopDraft(e.target.value)}
                className="flex-1 m-4 border border-slate-200 rounded-xl p-4 text-xs font-mono text-slate-700 focus:outline-none focus:border-asap-blue resize-none" />
              <div className="px-5 pb-4 flex gap-2 justify-end">
                <button onClick={() => setSopDraft(null)} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Discard</button>
                <button onClick={approveSOP} className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700">Approve and Attach</button>
              </div>
            </div>
          </div>
        )}"""
s = s.replace(a2, b2, 1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
print("panel patched: Generate SOP + review modal")
