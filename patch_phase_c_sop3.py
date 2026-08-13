import sys
f = 'src/pages/LeadershipProjects.jsx'
s = open(f, encoding='utf-8', errors='surrogateescape').read()

if "genSOP" in s: print("ABORTED: already patched"); sys.exit(1)
a1 = "with you. Ask me anything about it, or tell me what to change"
if s.count(a1) != 1: print("ABORTED msgs anchor x" + str(s.count(a1))); sys.exit(1)
line_end = s.index("\n", s.index(a1))

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
      setMsgs(p => [...p, { role: 'assistant', local: true, content: 'SOP v' + j.version + ' approved and attached to this project.' }]);
      setTimeout(() => onChanged(), 800);
    } catch (e) { setMsgs(p => [...p, { role: 'assistant', local: true, content: 'SOP approve failed: ' + e.message }]); }
  };"""
s = s[:line_end] + sop_logic + s[line_end:]

# header anchor is ambiguous file-wide (x2 - panel header AND the launch button),
# so take the first occurrence AFTER the panel's own state block, with a distance guard
after = line_end + len(sop_logic)
h = s.find("AI Project Manager</div>", after)
if h == -1: print("ABORTED: no header after panel state"); sys.exit(1)
if h - after > 4000: print("ABORTED: header too far (" + str(h - after) + ") - wrong site"); sys.exit(1)
ins = h + len("AI Project Manager</div>")

button = """
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
s = s[:ins] + button + s[ins:]
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
print("panel patched at offset " + str(h - after) + " past the state block")
