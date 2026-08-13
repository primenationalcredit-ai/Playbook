// ask-playbook-background.js - PHASE E answerer (15-min background fn, BKEY-gated).
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
      return '=== SOP: ' + d.title + ' (' + d.label + ') ===\n' + slice;
    }).join('\n\n');
    const prompt = 'You are the ASAP Credit Repair Playbook assistant. An employee asked a question about how we do something. Answer ONLY from the approved SOPs below.\n\nRULES:\n- If the SOPs answer it, answer plainly and practically in a few sentences, naming the exact screens/buttons the SOP names. Then on a final line write: SOURCE: <the SOP titles you used>.\n- If the SOPs do NOT cover it, say so directly: say it is not documented yet and that they should ask leadership. Do NOT guess, do NOT use general knowledge about credit repair or software, and never invent a screen or button.\n- If the SOPs partly cover it, answer the covered part and say plainly which part is not documented.\n- Write to the employee, second person, no preamble.\n\nQUESTION: ' + body.question + '\n\nAPPROVED SOPS:\n' + corpus;
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'x-api-key': AK, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 1200, messages: [{ role: 'user', content: prompt }] })
    });
    const data = await res.json().catch(() => ({}));
    const answer = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    if (!res.ok || !answer) { await save(nonce, { status: 'error', error: (data.error && data.error.message) || ('anthropic ' + res.status) }); return { statusCode: 200, body: 'err' }; }
    await save(nonce, { status: 'done', answer, sources: docs.map(d => d.title) });
    return { statusCode: 200, body: 'ok' };
  } catch (e) { if (nonce) await save(nonce, { status: 'error', error: e.message }).catch(() => {}); return { statusCode: 200, body: 'err' }; }
};
