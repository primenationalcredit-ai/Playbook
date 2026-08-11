// ai-project-builder-background.js - the heavy half of the AI Project Manager.
// Netlify background function (15-min limit): takes the approved interview
// transcript, has the AI emit the full project JSON, creates the card, and
// writes the outcome to app_cache aipm_{nonce} for the panel's status poll.
const SU = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SK = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const AK = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;
const BKEY = process.env.PAYMENT_API_KEY || process.env.PIPEDRIVE_API_KEY || '';
const H = { apikey: SK, Authorization: `Bearer ${SK}`, 'Content-Type': 'application/json' };
const IN_PROGRESS = '6cd85490-88b9-4f05-abba-009b9548398b';
const NOT_STARTED = '1653dbef-ccdc-4b2e-91ea-d485f7ec4663';

const BUILD_SYSTEM = (creator, today) => `You are the ASAP Credit Repair AI Project Manager. Below is an approved interview between leadership user ${creator} and you about a project. Today is ${today}. Output the complete project as ONE JSON object and NOTHING else - no prose, no markdown fences.

FIXED RULES: lifecycle order PREPLAN, LAYOUT, BUILD, TESTING, SOP, LAUNCH, TRAINING, TRACKING - prefix every task text with its phase; a not-applicable phase still gets one task "(not applicable: reason)". Always one task "TESTING - ASTRID: ..." assigned "Astrid Lemus" and one "TESTING - KIM: ..." assigned "Kim", each with step-by-step subtasks based on what is being built. TRAINING tasks come BEFORE launch (create training; employees view SOP, pass quiz, showcase one real example, sign off; overdue = Playbook locked). SOP phase: one task for the AI-written SOP posted to Google Drive, assigned "Joe + Claude". LAUNCH tasks match the style the creator chose. Every task gets a realistic yyyy-mm-dd due date sequenced from the start date. Default build work to "Joe + Claude", leadership decisions to "Leadership".

JSON SCHEMA (exactly these keys): {"title": str, "objective": str, "priority": "high"|"medium"|"low", "target_start_date": "yyyy-mm-dd"|null, "due_date": "yyyy-mm-dd"|null, "dependencies": str, "risks": str, "notes": str (start "WHERE WE ARE", then "WHAT'S NEXT" numbered, then "DEADLINE TABLE:" lines "- item: date"), "steps": [{"text": str, "assignee": str, "due": "yyyy-mm-dd"|null, "details": str, "subtasks": [{"text": str, "done": false}] (optional), "test_url": str (optional), "done": false}]}`;

const saveStatus = (nonce, obj) => fetch(`${SU}/rest/v1/app_cache`, {
  method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' },
  body: JSON.stringify({ cache_key: 'aipm_' + nonce, cache_value: JSON.stringify(obj), updated_at: new Date().toISOString() })
}).catch(() => {});

exports.handler = async (event) => {
  let nonce = null;
  try {
    const body = JSON.parse(event.body || '{}');
    nonce = body.nonce;
    if (!BKEY || body.key !== BKEY) return { statusCode: 401, body: 'unauthorized' };
    if (!nonce || !Array.isArray(body.transcript)) return { statusCode: 400, body: 'bad request' };
    const creator = body.creator || 'Leadership';
    const today = new Date().toISOString().slice(0, 10);
    const convo = body.transcript.map(m => `${m.role === 'user' ? creator : 'AI PM'}: ${m.content}`).join('\n\n');
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': AK, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 8000, system: BUILD_SYSTEM(creator, today), messages: [{ role: 'user', content: `THE APPROVED INTERVIEW:\n\n${convo}\n\nOutput ONLY the project JSON now.` }] })
    });
    if (!r.ok) { await saveStatus(nonce, { status: 'error', error: `anthropic ${r.status}` }); return { statusCode: 200, body: 'err saved' }; }
    const data = await r.json();
    let text = (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n').trim();
    text = text.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim();
    const first = text.indexOf('{'); const last = text.lastIndexOf('}');
    if (first === -1 || last === -1) { await saveStatus(nonce, { status: 'error', error: 'no JSON in model output' }); return { statusCode: 200, body: 'err saved' }; }
    let proj = null;
    try { proj = JSON.parse(text.slice(first, last + 1)); } catch (e) { await saveStatus(nonce, { status: 'error', error: 'model JSON malformed - try approving again' }); return { statusCode: 200, body: 'err saved' }; }
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
    if (!ins.ok || !Array.isArray(created) || !created[0]) { await saveStatus(nonce, { status: 'error', error: 'card insert failed: ' + JSON.stringify(created).slice(0, 200) }); return { statusCode: 200, body: 'err saved' }; }
    const card = created[0];
    await saveStatus(nonce, { status: 'done', created: { id: card.id, title: card.title, tasks: (card.steps || []).length, due: card.due_date } });
    return { statusCode: 200, body: 'done' };
  } catch (e) {
    if (nonce) await saveStatus(nonce, { status: 'error', error: e.message });
    return { statusCode: 200, body: 'err' };
  }
};
