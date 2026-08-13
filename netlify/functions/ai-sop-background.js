// ai-sop-background.js - PHASE C generator (15-min background fn, BKEY-gated).
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
    const tasks = (card.steps || []).map((st, i) => (i + 1) + '. ' + st.text + (st.assignee ? ' (owner: ' + st.assignee + ')' : '') + (st.details ? '\n   Details: ' + String(st.details).slice(0, 800) : '') + (Array.isArray(st.subtasks) && st.subtasks.length ? '\n   Checklist: ' + st.subtasks.map(sb => sb.text).join(' | ').slice(0, 1200) : '')).join('\n');
    const prompt = 'Write the official Standard Operating Procedure for the completed ASAP Credit Repair project below. Employees will read it, be quizzed on it, and follow it forever - write for a brand-new employee who has never seen this feature.\n\nPROJECT: ' + card.title + '\nOBJECTIVE: ' + (card.objective || '-') + '\nNOTES/PLAN: ' + String(card.notes || '-').slice(0, 2500) + '\nDEPENDENCIES: ' + (card.dependencies || '-') + '\nRISKS/EDGE CASES: ' + (card.risks || '-') + '\nTASKS BUILT (with details):\n' + (tasks || '(none)') + '\n\nFORMAT (markdown): # SOP: <title>, then sections: Purpose (2-3 sentences); Who This Applies To (roles); When To Use This; Step-by-Step Procedure (numbered, concrete, per-role where relevant, written from the built tasks - describe USING the feature, not building it); Edge Cases and What To Do; FAQ (6-8 real questions a confused employee would ask, with answers); Escalation (when to ask leadership). End with the line: (SOP version and approval are recorded automatically.) No preamble, no closing commentary - the document only.';
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'x-api-key': AK, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 8000, messages: [{ role: 'user', content: prompt }] })
    });
    const data = await res.json().catch(() => ({}));
    const draft = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    if (!res.ok || !draft) { await save(nonce, { status: 'error', error: (data.error && data.error.message) || ('anthropic ' + res.status) }); return { statusCode: 200, body: 'err' }; }
    await save(nonce, { status: 'done', draft });
    return { statusCode: 200, body: 'ok' };
  } catch (e) { if (nonce) await save(nonce, { status: 'error', error: e.message }).catch(() => {}); return { statusCode: 200, body: 'err' }; }
};
