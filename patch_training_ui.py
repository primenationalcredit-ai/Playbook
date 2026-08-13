import sys
f='src/pages/LeadershipProjects.jsx'; s=open(f,encoding='utf-8',errors='surrogateescape').read()
if 'genTraining' in s: print("SKIP: already patched"); sys.exit(0)
a="  const approveSOP = async () => {"
if s.count(a)!=1: print("ABORT approveSOP anchor x"+str(s.count(a))); sys.exit(1)
s=s.replace(a, """  // TRAINING BUILDER (Joe 8/13): approved SOP -> real course, created unpublished
  // so leadership reviews and publishes it (publishing is what assigns it).
  const [trnBusy, setTrnBusy] = useState(false);
  const genTraining = async () => {
    if (trnBusy) return; setTrnBusy(true);
    setMsgs(p => [...p, { role: 'assistant', local: true, content: 'Building a training course from the approved SOP - 30 to 90 seconds...' }]);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess && sess.session && sess.session.access_token;
      const hdr = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token };
      const st = await fetch('/.netlify/functions/ai-training-from-sop', { method: 'POST', headers: hdr, body: JSON.stringify({ action: 'start', card_id: card.id }) });
      const sj = await st.json();
      if (sj.warn) { setMsgs(p => [...p, { role: 'assistant', local: true, content: sj.warn }]); setTrnBusy(false); return; }
      if (!st.ok || !sj.nonce) throw new Error(sj.error || 'start failed');
      for (let t = 0; t < 100; t++) {
        await new Promise(r => setTimeout(r, 3000));
        const pr = await fetch('/.netlify/functions/ai-training-from-sop', { method: 'POST', headers: hdr, body: JSON.stringify({ action: 'status', nonce: sj.nonce }) });
        const pj = await pr.json();
        if (pj.status === 'done') {
          setMsgs(p => [...p, { role: 'assistant', local: true, content: 'Created "' + (pj.title || 'the course') + '" as a DRAFT: ' + pj.modules + ' modules, ' + pj.lessons + ' lessons, ' + pj.questions + ' scenario questions. Review it in Training Portal and publish when it looks right - publishing is what assigns it to people.' }]);
          setTrnBusy(false); return;
        }
        if (pj.status === 'error') throw new Error(pj.error || 'build failed');
      }
      throw new Error('timed out');
    } catch (e) { setMsgs(p => [...p, { role: 'assistant', local: true, content: 'Training build failed: ' + e.message }]); setTrnBusy(false); }
  };
"""+a,1)
b="<button onClick={() => genSOP(false)} disabled={sopBusy}"
if s.count(b)!=1: print("ABORT sop button anchor x"+str(s.count(b))); sys.exit(1)
s=s.replace(b, """<button onClick={genTraining} disabled={trnBusy} className="ml-auto mr-2 px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-semibold disabled:opacity-50">{trnBusy ? 'Building...' : 'Generate Training'}</button>
        <button onClick={() => genSOP(false)} disabled={sopBusy}""",1)
s=s.replace('<button onClick={() => genSOP(false)} disabled={sopBusy} className="ml-auto mr-2','<button onClick={() => genSOP(false)} disabled={sopBusy} className="mr-2',1)
open(f,'w',encoding='utf-8',errors='surrogateescape',newline='').write(s)
print("2/2 Generate Training button wired")
