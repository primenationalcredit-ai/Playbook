// ai-project-planner.js - PHASE A of the AI Project Manager (Joe 8/11).
// Leadership describes a project in plain language; the AI interviews them,
// summarizes for approval, and ON APPROVAL creates the project card itself.
// Auth: user session token -> Supabase auth -> users table; leadership/admin only.
const SU = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SK = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const AK = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;
const H = { apikey: SK, Authorization: `Bearer ${SK}`, 'Content-Type': 'application/json' };
const IN_PROGRESS = '6cd85490-88b9-4f05-abba-009b9548398b';
const NOT_STARTED = '1653dbef-ccdc-4b2e-91ea-d485f7ec4663';
const respond = (c, b) => ({ statusCode: c, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });

const SYSTEM = (creator, today) => `You are the ASAP Credit Repair AI Project Manager inside the Playbook app. A leadership user (${creator}) wants to create a project. Today is ${today}.

YOUR JOB, IN ORDER:
1. INTERVIEW: Ask focused questions (1-3 at a time, plain language, no jargon) until you truly understand: what they want built or changed, why, who does the work, who is affected, what done looks like, the start date (always ask), and any deadline. Ask as many rounds as needed - do not guess.
2. SUMMARIZE: When satisfied, present a clear summary of the project (goal, phases, key tasks, owners, dates) and ask: "Should I create this project? Reply yes to create it, or tell me what to change."
3. CREATE: ONLY after they clearly approve, output the project as JSON between <PROJECT_JSON> and </PROJECT_JSON> markers, with a one-line confirmation before the markers. Never output the markers before approval.

FIXED RULES (company policy, non-negotiable):
- Every project uses this lifecycle in this order: PREPLAN, LAYOUT, BUILD, TESTING, SOP, LAUNCH, TRAINING, TRACKING. Prefix each task's text with its phase (e.g. "BUILD: ..."). If a phase does not apply, still include one task for it marked "(not applicable: <reason>)" - never silently skip.
- TESTING tasks: always create one task "TESTING - ASTRID: ..." assigned to "Astrid Lemus" and one "TESTING - KIM: ..." assigned to "Kim", each with subtasks spelling out exactly what to test step by step, based on what is being built.
- TRAINING is built BEFORE launch: include tasks for creating the training, employees completing it (view SOP, pass the quiz, showcase one real example, sign off), and note that overdue training locks the Playbook for that employee.
- SOP phase: one task for the AI-written SOP being generated and posted to Google Drive (that engine is coming; for now the task is assigned to "Joe + Claude").
- LAUNCH: ask the creator during the interview whether launch is a self-serve release or a leader-led demo meeting, and build the launch tasks to match.
- If a start date is given, give EVERY task a realistic due date (yyyy-mm-dd) sequenced through the phases. If no deadline was given, propose one.
- Assignees: use real names the creator gives you; default build work to "Joe + Claude"; leadership decisions to "Leadership".

PROJECT_JSON SCHEMA (exactly these keys):
{"title": str, "objective": str, "priority": "high"|"medium"|"low", "target_start_date": "yyyy-mm-dd"|null, "due_date": "yyyy-mm-dd"|null, "dependencies": str, "risks": str, "notes": str (start with "WHERE WE ARE", then "WHAT'S NEXT" numbered, then "DEADLINE TABLE:" with one "- item: date" line per major date), "steps": [{"text": str, "assignee": str, "due": "yyyy-mm-dd"|null, "details": str (exact how-to instructions), "subtasks": [{"text": str, "done": false}] (optional), "test_url": str (optional), "done": false}]}

Keep replies conversational and tight. Never invent facts about the company; ask instead.`;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return respond(405, { error: 'POST only' });
  try {
    if (!AK) return respond(500, { error: 'ANTHROPIC_API_KEY missing on this site' });
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
    const messages = (Array.isArray(body.messages) ? body.messages : []).filter(m => m && (m.role === 'user' || m.role === 'assistant') && m.content).map(m => ({ role: m.role, content: String(m.content) }));
    if (!messages.length || messages[0].role !== 'user') return respond(400, { error: 'messages must start with a user turn' });

    const today = new Date().toISOString().slice(0, 10);
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': AK, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 6000, system: SYSTEM(creator, today), messages })
    });
    if (!r.ok) return respond(502, { error: `anthropic ${r.status}: ${(await r.text()).slice(0, 300)}` });
    const data = await r.json();
    let reply = (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n');

    // Approval detected: the model emitted the project JSON - create the card server-side.
    const m = reply.match(/<PROJECT_JSON>([\s\S]*?)<\/PROJECT_JSON>/);
    if (m) {
      let proj = null;
      try { proj = JSON.parse(m[1].trim()); } catch (e) {
        return respond(200, { reply: reply.replace(/<PROJECT_JSON>[\s\S]*?<\/PROJECT_JSON>/, '').trim() + '\n\n(I drafted the project but the format came out malformed - say "try again" and I will re-emit it.)' });
      }
      const row = {
        title: String(proj.title || 'Untitled project').slice(0, 200),
        objective: proj.objective || null,
        stage_id: proj.target_start_date && proj.target_start_date <= today ? IN_PROGRESS : NOT_STARTED,
        owner_name: creator,
        priority: ['high', 'medium', 'low'].includes(proj.priority) ? proj.priority : 'medium',
        target_start_date: proj.target_start_date || null,
        due_date: proj.due_date || null,
        dependencies: proj.dependencies || null,
        risks: proj.risks || null,
        notes: proj.notes || null,
        steps: Array.isArray(proj.steps) ? proj.steps.map(st => ({
          text: String(st.text || '').slice(0, 500), assignee: st.assignee || '', due: st.due || '',
          details: st.details || '', test_url: st.test_url || '', done: false,
          ...(Array.isArray(st.subtasks) && st.subtasks.length ? { subtasks: st.subtasks.map(sb => ({ text: String(sb.text || '').slice(0, 300), done: false })) } : {})
        })) : [],
        position: 50,
        updates: [{ text: `Project created by the AI Project Manager from ${creator}'s interview.`, by: 'AI Project Manager', at: new Date().toISOString() }]
      };
      const ins = await fetch(`${SU}/rest/v1/project_cards`, { method: 'POST', headers: { ...H, Prefer: 'return=representation' }, body: JSON.stringify(row) });
      const created = await ins.json().catch(() => null);
      if (!ins.ok || !Array.isArray(created) || !created[0]) return respond(200, { reply: 'I tried to create the project but the save failed - tell Joe. Raw error: ' + JSON.stringify(created).slice(0, 200) });
      const card = created[0];
      return respond(200, { reply: reply.replace(/<PROJECT_JSON>[\s\S]*?<\/PROJECT_JSON>/, '').trim(), created: { id: card.id, title: card.title, tasks: (card.steps || []).length, due: card.due_date } });
    }
    return respond(200, { reply });
  } catch (e) { return respond(500, { error: e.message }); }
};
