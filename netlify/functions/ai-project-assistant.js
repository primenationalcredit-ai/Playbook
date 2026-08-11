// ai-project-assistant.js - PHASE B of the AI Project Manager (Joe 8/11).
// The same brain pointed at an EXISTING project: leadership types "push testing
// out two days" / "add a task for X" / "mark layout done" and it edits the card.
// The model replies conversationally and emits compact <OPS> JSON we apply
// server-side (ops, not full-card JSON, so the turn stays inside the sync limit).
const SU = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SK = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const AK = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;
const H = { apikey: SK, Authorization: `Bearer ${SK}`, 'Content-Type': 'application/json' };
const respond = (c, b) => ({ statusCode: c, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
const PHASES = ['PREPLAN','LAYOUT','BUILD','TESTING','SOP','LAUNCH','TRAINING','TRACKING'];

const SYSTEM = (creator, today, card) => {
  const tasks = (card.steps || []).map((st, i) => `${i}. [${st.done ? 'x' : ' '}] ${st.text} | assignee: ${st.assignee || '-'} | due: ${st.due || '-'}${Array.isArray(st.subtasks) && st.subtasks.length ? ` | subtasks: ${st.subtasks.map((sb, j) => `${j}:[${sb.done ? 'x' : ' '}] ${sb.text}`).join('; ')}` : ''}`).join('\n');
  return `You are the ASAP Credit Repair AI Project Manager, assisting leadership user ${creator} with the EXISTING project below. Today is ${today}.

THE PROJECT:
Title: ${card.title}
Phase: ${card.phase || 'PREPLAN'} (lifecycle: ${PHASES.join(' > ')})
Priority: ${card.priority} | Start: ${card.target_start_date || '-'} | Deadline: ${card.due_date || '-'} | Owner: ${card.owner_name || '-'}
Objective: ${card.objective || '-'}
Notes: ${(card.notes || '-').slice(0, 1500)}
Dependencies: ${card.dependencies || '-'} | Risks: ${card.risks || '-'}
TASKS (index. [done] text | assignee | due | subtasks j:[done] text):
${tasks || '(none)'}

YOUR JOB: help them manage this project - answer questions, make suggestions, and APPLY changes they ask for. When they request changes, reply with a short confirmation of what you're doing, then emit the operations between <OPS> and </OPS> as a JSON array. Only emit ops for changes they asked for or clearly approved. If they're only asking a question, no OPS block.

OPS (use task index numbers and subtask j from the list above):
{"op":"meta","fields":{...}} - any of: title, objective, notes, dependencies, risks, priority(high|medium|low), target_start_date, due_date(yyyy-mm-dd or null), phase(one of the 8)
{"op":"task_set","i":N,"fields":{...}} - any of: text, assignee, due, details, test_url, done(true|false)
{"op":"task_add","task":{"text","assignee","due","details","subtasks":[{"text"}]}} - subtasks optional
{"op":"task_remove","i":N}
{"op":"sub_add","i":N,"text":"..."}
{"op":"sub_set","i":N,"j":M,"done":true|false}
{"op":"update","text":"..."} - post a note to the project's Updates log

Rules: dates yyyy-mm-dd. When moving a set of dates, emit one task_set per affected task. Never invent company facts; ask. Keep replies tight.`;
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return respond(405, { error: 'POST only' });
  try {
    if (!AK) return respond(500, { error: 'ANTHROPIC_API_KEY missing' });
    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    if (!authHeader.startsWith('Bearer ')) return respond(401, { error: 'no session' });
    const uRes = await fetch(`${SU}/auth/v1/user`, { headers: { apikey: SK, Authorization: authHeader } });
    if (!uRes.ok) return respond(401, { error: 'invalid session' });
    const authUser = await uRes.json();
    const prof = await fetch(`${SU}/rest/v1/users?email=eq.${encodeURIComponent(authUser.email)}&select=name,department,role`, { headers: H }).then(r => r.json()).catch(() => []);
    const u = Array.isArray(prof) && prof[0] ? prof[0] : {};
    const isLeader = ['leadership', 'admin'].includes(String(u.department || '').toLowerCase()) || String(u.role || '').toLowerCase() === 'admin';
    if (!isLeader) return respond(403, { error: 'Leadership only' });
    const creator = u.name || authUser.email;

    let body = {}; try { body = JSON.parse(event.body || '{}'); } catch (e) {}
    if (!body.card_id) return respond(400, { error: 'card_id required' });
    const cards = await fetch(`${SU}/rest/v1/project_cards?id=eq.${encodeURIComponent(body.card_id)}&select=*`, { headers: H }).then(r => r.json()).catch(() => []);
    if (!Array.isArray(cards) || !cards[0]) return respond(404, { error: 'project not found' });
    const card = cards[0];
    const messages = (Array.isArray(body.messages) ? body.messages : []).filter(m => m && (m.role === 'user' || m.role === 'assistant') && m.content).map(m => ({ role: m.role, content: String(m.content) }));
    if (!messages.length || messages[0].role !== 'user') return respond(400, { error: 'messages must start with a user turn' });

    const today = new Date().toISOString().slice(0, 10);
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': AK, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 2500, system: SYSTEM(creator, today, card), messages })
    });
    if (!r.ok) return respond(502, { error: `anthropic ${r.status}: ${(await r.text()).slice(0, 300)}` });
    const data = await r.json();
    let reply = (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n');

    let applied = 0;
    const om = reply.match(/<OPS>([\s\S]*?)<\/OPS>/);
    if (om) {
      reply = reply.replace(/<OPS>[\s\S]*?<\/OPS>/, '').trim();
      let ops = [];
      try { ops = JSON.parse(om[1].trim()); } catch (e) { return respond(200, { reply: reply + '\n\n(My edit instructions came out malformed - ask me again.)' }); }
      if (!Array.isArray(ops)) ops = [];
      const steps = Array.isArray(card.steps) ? JSON.parse(JSON.stringify(card.steps)) : [];
      const updates = Array.isArray(card.updates) ? card.updates : [];
      const patch = {};
      const okI = (i) => Number.isInteger(i) && i >= 0 && i < steps.length;
      const metaKeys = ['title','objective','notes','dependencies','risks','priority','target_start_date','due_date','phase'];
      for (const op of ops) {
        if (!op || typeof op !== 'object') continue;
        if (op.op === 'meta' && op.fields) {
          for (const k of metaKeys) if (k in op.fields) {
            if (k === 'phase' && !PHASES.includes(op.fields[k])) continue;
            patch[k] = op.fields[k] === '' ? null : op.fields[k]; applied++;
          }
        } else if (op.op === 'task_set' && okI(op.i) && op.fields) {
          const st = steps[op.i];
          for (const k of ['text','assignee','due','details','test_url']) if (k in op.fields) { st[k] = op.fields[k]; applied++; }
          if ('done' in op.fields) { st.done = !!op.fields.done; st.done_by = st.done ? 'AI Project Manager' : null; st.done_at = st.done ? new Date().toISOString() : null; applied++; }
        } else if (op.op === 'task_add' && op.task && op.task.text) {
          steps.push({ text: String(op.task.text).slice(0, 500), assignee: op.task.assignee || '', due: op.task.due || '', details: op.task.details || '', test_url: op.task.test_url || '', done: false,
            ...(Array.isArray(op.task.subtasks) && op.task.subtasks.length ? { subtasks: op.task.subtasks.map(sb => ({ text: String(sb.text || sb).slice(0, 300), done: false })) } : {}) });
          applied++;
        } else if (op.op === 'task_remove' && okI(op.i)) {
          steps[op.i] = null; applied++;
        } else if (op.op === 'sub_add' && okI(op.i) && op.text) {
          steps[op.i].subtasks = steps[op.i].subtasks || []; steps[op.i].subtasks.push({ text: String(op.text).slice(0, 300), done: false }); applied++;
        } else if (op.op === 'sub_set' && okI(op.i) && Array.isArray(steps[op.i].subtasks) && Number.isInteger(op.j) && op.j >= 0 && op.j < steps[op.i].subtasks.length) {
          const sb = steps[op.i].subtasks[op.j]; sb.done = !!op.done; sb.done_by = sb.done ? 'AI Project Manager' : null; applied++;
        } else if (op.op === 'update' && op.text) {
          updates.unshift({ text: String(op.text).slice(0, 1000), by: 'AI Project Manager', at: new Date().toISOString() }); applied++;
        }
      }
      if (applied) {
        patch.steps = steps.filter(Boolean);
        patch.updates = updates;
        patch.updated_at = new Date().toISOString();
        const up = await fetch(`${SU}/rest/v1/project_cards?id=eq.${encodeURIComponent(card.id)}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(patch) });
        if (!up.ok) return respond(200, { reply: reply + '\n\n(The save failed - tell Joe: ' + (await up.text()).slice(0, 150) + ')' });
      }
    }
    return respond(200, { reply, applied });
  } catch (e) { return respond(500, { error: e.message }); }
};
