import sys
D = """// ask-playbook.js - PHASE E of the AI Project Manager (Joe 8/13).
// Answers process questions from the approved SOP corpus. Open to EVERY logged-in
// employee (not leadership-only) - the whole point is that staff look it up.
const SU = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SK = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const BKEY = process.env.PAYMENT_API_KEY || process.env.PIPEDRIVE_API_KEY || '';
const SITE = process.env.URL || 'https://cute-cat-d9631c.netlify.app';
const H = { apikey: SK, Authorization: `Bearer ${SK}`, 'Content-Type': 'application/json' };
const respond = (c, b) => ({ statusCode: c, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
async function requireUser(event) {
  const tok = (event.headers?.authorization || event.headers?.Authorization || '').replace(/^Bearer\\s+/i, '');
  if (!tok) return null;
  const r = await fetch(`${SU}/auth/v1/user`, { headers: { apikey: SK, Authorization: `Bearer ${tok}` } });
  if (!r.ok) return null;
  const u = await r.json().catch(() => null);
  return u && u.id ? u : null;
}
exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return respond(405, { error: 'POST only' });
    let body = {}; try { body = JSON.parse(event.body || '{}'); } catch (e) {}
    if (!(await requireUser(event))) return respond(403, { error: 'sign in first' });
    if (body.action === 'status' && body.nonce) {
      const rows = await fetch(`${SU}/rest/v1/app_cache?cache_key=eq.${encodeURIComponent('askpb_' + body.nonce)}&select=cache_value`, { headers: H }).then(r => r.json());
      if (!Array.isArray(rows) || !rows.length) return respond(200, { status: 'unknown' });
      let v = {}; try { v = JSON.parse(rows[0].cache_value); } catch (e) {}
      return respond(200, v);
    }
    if (body.action === 'ask' && body.question) {
      const nonce = Math.random().toString(36).slice(2, 12);
      await fetch(`${SU}/rest/v1/app_cache`, { method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({ cache_key: 'askpb_' + nonce, cache_value: JSON.stringify({ status: 'thinking' }), updated_at: new Date().toISOString() }) });
      fetch(`${SITE}/.netlify/functions/ask-playbook-background`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nonce, key: BKEY, question: String(body.question).slice(0, 1000) }) }).catch(() => {});
      return respond(200, { nonce });
    }
    return respond(400, { error: 'unknown action' });
  } catch (e) { return respond(500, { error: e.message }); }
};
"""
open('netlify/functions/ask-playbook.js','w',encoding='utf-8',newline='').write(D)

B = """// ask-playbook-background.js - PHASE E answerer (15-min background fn, BKEY-gated).
// Reads every approved SOP off the project cards and answers STRICTLY from them.
const SU = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SK = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const AK = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;
const BKEY = process.env.PAYMENT_API_KEY || process.env.PIPEDRIVE_API_KEY || '';
const H = { apikey: SK, Authorization: `Bearer ${SK}`, 'Content-Type': 'application/json' };
async function save(nonce, val) {
  await fetch(`${SU}/rest/v1/app_cache?cache_key=eq.${encodeURIComponent('askpb_' + nonce)}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' },
    body: JSON.stringify({ cache_value: JSON.stringify(val), updated_at: new Date().toISOString() }) });
}
exports.handler = async (event) => {
  let nonce = null;
  try {
    const body = JSON.parse(event.body || '{}');
    nonce = body.nonce;
    if (!nonce || !BKEY || body.key !== BKEY) return { statusCode: 401, body: 'no' };
    const cards = await fetch(`${SU}/rest/v1/project_cards?select=title,links`, { headers: H }).then(r => r.json());
    const docs = [];
    (Array.isArray(cards) ? cards : []).forEach(c => {
      (Array.isArray(c.links) ? c.links : []).forEach(l => {
        if (l && l.sop && l.content) docs.push({ title: c.title, label: l.label || l.name || 'SOP', content: String(l.content) });
      });
    });
    if (!docs.length) { await save(nonce, { status: 'done', answer: 'There are no approved SOPs yet, so there is nothing for me to answer from. Once leadership approves an SOP on a project it becomes searchable here.', sources: [] }); return { statusCode: 200, body: 'ok' }; }
    let budget = 120000;
    const corpus = docs.map(d => {
      const slice = d.content.slice(0, Math.max(0, Math.min(30000, budget)));
      budget -= slice.length;
      return '=== SOP: ' + d.title + ' (' + d.label + ') ===\\n' + slice;
    }).join('\\n\\n');
    const prompt = 'You are the ASAP Credit Repair Playbook assistant. An employee asked a question about how we do something. Answer ONLY from the approved SOPs below.\\n\\nRULES:\\n- If the SOPs answer it, answer plainly and practically in a few sentences, naming the exact screens/buttons the SOP names. Then on a final line write: SOURCE: <the SOP titles you used>.\\n- If the SOPs do NOT cover it, say so directly: say it is not documented yet and that they should ask leadership. Do NOT guess, do NOT use general knowledge about credit repair or software, and never invent a screen or button.\\n- If the SOPs partly cover it, answer the covered part and say plainly which part is not documented.\\n- Write to the employee, second person, no preamble.\\n\\nQUESTION: ' + body.question + '\\n\\nAPPROVED SOPS:\\n' + corpus;
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'x-api-key': AK, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 1200, messages: [{ role: 'user', content: prompt }] })
    });
    const data = await res.json().catch(() => ({}));
    const answer = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\\n').trim();
    if (!res.ok || !answer) { await save(nonce, { status: 'error', error: (data.error && data.error.message) || ('anthropic ' + res.status) }); return { statusCode: 200, body: 'err' }; }
    await save(nonce, { status: 'done', answer, sources: docs.map(d => d.title) });
    return { statusCode: 200, body: 'ok' };
  } catch (e) { if (nonce) await save(nonce, { status: 'error', error: e.message }).catch(() => {}); return { statusCode: 200, body: 'err' }; }
};
"""
open('netlify/functions/ask-playbook-background.js','w',encoding='utf-8',newline='').write(B)
print("1/2 ask-playbook functions written")

f='src/pages/SopLibrary.jsx'; s=open(f,encoding='utf-8',errors='surrogateescape').read()
if 'askPlaybook' in s: print("SKIP 2/2"); sys.exit(0)
s=s.replace("import { BookOpen, Search, FileText, Loader2 } from 'lucide-react';",
            "import { BookOpen, Search, FileText, Loader2, Sparkles, Send } from 'lucide-react';\nimport { supabase } from '../lib/supabase';",1)
s=s.replace("  const [open, setOpen] = useState(null);",
"""  const [open, setOpen] = useState(null);
  // ASK THE PLAYBOOK (Phase E): answers strictly from the approved SOPs above.
  const [ask, setAsk] = useState('');
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState(null);
  const askPlaybook = async () => {
    const question = ask.trim();
    if (!question || asking) return;
    setAsking(true); setAnswer(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess && sess.session && sess.session.access_token;
      const hdr = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token };
      const r = await fetch('/.netlify/functions/ask-playbook', { method: 'POST', headers: hdr, body: JSON.stringify({ action: 'ask', question }) });
      const j = await r.json();
      if (!r.ok || !j.nonce) throw new Error(j.error || 'could not ask');
      for (let t = 0; t < 60; t++) {
        await new Promise(res => setTimeout(res, 2000));
        const pr = await fetch('/.netlify/functions/ask-playbook', { method: 'POST', headers: hdr, body: JSON.stringify({ action: 'status', nonce: j.nonce }) });
        const pj = await pr.json();
        if (pj.status === 'done') { setAnswer(pj.answer); setAsking(false); return; }
        if (pj.status === 'error') throw new Error(pj.error || 'failed');
      }
      throw new Error('timed out');
    } catch (e) { setAnswer('Could not answer: ' + e.message); setAsking(false); }
  };""",1)
s=s.replace('''      <div className="relative my-5">''',
'''      <div className="mt-5 rounded-2xl border border-violet-200 bg-violet-50/50 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-violet-600" />
          <div className="text-sm font-semibold text-slate-800">Ask the Playbook</div>
          <div className="text-xs text-slate-500">answers only from approved SOPs</div>
        </div>
        <div className="flex gap-2">
          <input value={ask} onChange={e => setAsk(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') askPlaybook(); }}
            placeholder="How do I ... ?" className="flex-1 px-3 py-2 border border-violet-200 rounded-xl text-sm bg-white focus:outline-none focus:border-violet-500" />
          <button onClick={askPlaybook} disabled={asking} className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 flex items-center gap-1.5">
            {asking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}{asking ? 'Reading SOPs' : 'Ask'}
          </button>
        </div>
        {answer && <div className="mt-3 bg-white border border-violet-200 rounded-xl p-4 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{answer}</div>}
      </div>
      <div className="relative my-5">''',1)
open(f,'w',encoding='utf-8',errors='surrogateescape',newline='').write(s)
print("2/2 SopLibrary.jsx: Ask the Playbook")
