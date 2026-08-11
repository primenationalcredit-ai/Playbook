import sys
f = 'src/pages/LeadershipProjects.jsx'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
old = """      const j = await res.json();
      if (!res.ok) { setMsgs(p => [...p, { role: 'assistant', content: `Error: ${j.error || res.status}` }]); }
      else {
        setMsgs(p => [...p, { role: 'assistant', content: j.reply || '(no reply)' }]);
        if (j.created) { setCreated(j.created); onCreated(); }
      }"""
new = """      const j = await res.json();
      if (!res.ok) { setMsgs(p => [...p, { role: 'assistant', content: `Error: ${j.error || res.status}` }]); }
      else {
        setMsgs(p => [...p, { role: 'assistant', content: j.reply || '(no reply)' }]);
        if (j.created) { setCreated(j.created); onCreated(); }
        if (j.creating && j.nonce) pollStatus(j.nonce, 0);
      }"""
if s.count(old) != 1: print(f"ABORTED: send-handler anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
old2 = """  const send = async () => {"""
new2 = """  const pollStatus = async (nonce, tries) => {
    if (tries > 80) { setMsgs(p => [...p, { role: 'assistant', content: 'The build is taking unusually long - check the board in a minute, or approve again.' }]); return; }
    await new Promise(rs => setTimeout(rs, 3000));
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess && sess.session && sess.session.access_token;
      const res = await fetch('/.netlify/functions/ai-project-planner', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'status', nonce })
      });
      const j = await res.json();
      if (j.status === 'done' && j.created) {
        setCreated(j.created); onCreated();
        setMsgs(p => [...p, { role: 'assistant', content: `Done - "${j.created.title}" is on the board with ${j.created.tasks} tasks${j.created.due ? `, due ${j.created.due}` : ''}.` }]);
        return;
      }
      if (j.status === 'error') { setMsgs(p => [...p, { role: 'assistant', content: `Build failed: ${j.error}. Say "yes, create it" to try again.` }]); return; }
    } catch (e) { /* transient - keep polling */ }
    pollStatus(nonce, tries + 1);
  };
  const send = async () => {"""
if s.count(old2) != 1: print(f"ABORTED: send-def anchor x{s.count(old2)}"); sys.exit(1)
s = s.replace(old2, new2, 1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
print("panel: async build polling in")
