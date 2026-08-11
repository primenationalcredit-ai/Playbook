// ai-project-planner.js v2 - chat turns stay fast; CREATION goes async (Joe 8/11:
// the JSON-emission turn exceeded Netlify's 10s sync limit -> HTML 502 in the panel).
// On approval the model emits <CREATE_NOW>; we hand the transcript to the
// -background builder (15 min limit) and the panel polls action=status.
const SU = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SK = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const AK = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;
const SITE = process.env.URL || 'https://cute-cat-d9631c.netlify.app';
const BKEY = process.env.PAYMENT_API_KEY || process.env.PIPEDRIVE_API_KEY || '';
const H = { apikey: SK, Authorization: `Bearer ${SK}`, 'Content-Type': 'application/json' };
const respond = (c, b) => ({ statusCode: c, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });

const SYSTEM = (creator, today) => `You are the ASAP Credit Repair AI Project Manager inside the Playbook app. A leadership user (${creator}) wants to create a project. Today is ${today}.

YOUR JOB, IN ORDER:
1. INTERVIEW: Ask focused questions (1-3 at a time, plain language) until you truly understand: what they want built or changed, why, who does the work, who is affected, what done looks like, the start date (always ask), any deadline, and whether launch is a self-serve release or a leader-led demo meeting. Ask as many rounds as needed - do not guess.
2. SUMMARIZE: When satisfied, present a clear summary (goal, key features, phases, owners, dates) and ask: "Should I create this project? Reply yes to create it, or tell me what to change."
3. ON CLEAR APPROVAL: reply with ONE short sentence confirming you are building it now, and end your reply with the exact token <CREATE_NOW> on its own line. NEVER output project JSON in this chat, and never output the token before clear approval.

FIXED COMPANY RULES you will bake into every project: lifecycle PREPLAN, LAYOUT, BUILD, TESTING, SOP, LAUNCH, TRAINING, TRACKING (a not-applicable phase still gets one task saying why); testers are ALWAYS Astrid Lemus and Kim with step-by-step scripts; training is built BEFORE launch (view SOP, quiz, showcase a real example, sign off; overdue training locks the Playbook); the SOP is AI-written and posted to Google Drive; dated tasks sequenced from the start date.

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

    // ---- status poll (fast) ----
    if (body.action === 'status' && body.nonce) {
      const rows = await fetch(`${SU}/rest/v1/app_cache?cache_key=eq.${encodeURIComponent('aipm_' + body.nonce)}&select=cache_value`, { headers: H }).then(r => r.json()).catch(() => []);
      if (!Array.isArray(rows) || !rows[0]) return respond(200, { status: 'building' });
      let v = {}; try { v = JSON.parse(rows[0].cache_value); } catch (e) {}
      return respond(200, v);
    }

    // ---- chat turn (fast: capped tokens) ----
    const messages = (Array.isArray(body.messages) ? body.messages : []).filter(m => m && (m.role === 'user' || m.role === 'assistant') && m.content).map(m => ({ role: m.role, content: String(m.content) }));
    if (!messages.length || messages[0].role !== 'user') return respond(400, { error: 'messages must start with a user turn' });
    const today = new Date().toISOString().slice(0, 10);
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': AK, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 1500, system: SYSTEM(creator, today), messages })
    });
    if (!r.ok) return respond(502, { error: `anthropic ${r.status}: ${(await r.text()).slice(0, 300)}` });
    const data = await r.json();
    let reply = (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n');

    if (reply.includes('<CREATE_NOW>')) {
      reply = reply.replace(/<CREATE_NOW>/g, '').trim();
      const nonce = Math.random().toString(36).slice(2, 12);
      await fetch(`${SU}/rest/v1/app_cache`, { method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ cache_key: 'aipm_' + nonce, cache_value: JSON.stringify({ status: 'building' }), updated_at: new Date().toISOString() }) });
      // hand off to the background builder (15-min limit). Auth = the nonce row
      // itself (only this session-authed function creates it). Record the invoke
      // status so a failed handoff is visible instead of silently stuck.
      let invokeStatus = 0;
      try {
        const ir = await fetch(`${SITE}/.netlify/functions/ai-project-builder-background`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nonce, creator, transcript: [...messages, { role: 'assistant', content: reply }] })
        });
        invokeStatus = ir.status;
      } catch (e) { console.error('builder invoke failed:', e.message); }
      if (invokeStatus >= 300 || invokeStatus === 0) {
        await fetch(`${SU}/rest/v1/app_cache`, { method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify({ cache_key: 'aipm_' + nonce, cache_value: JSON.stringify({ status: 'error', error: `builder handoff failed (http ${invokeStatus}) - approve again to retry` }), updated_at: new Date().toISOString() }) });
      }
      return respond(200, { reply: reply || 'Building your project now - this takes about a minute.', creating: true, nonce });
    }
    return respond(200, { reply });
  } catch (e) { return respond(500, { error: e.message }); }
};
