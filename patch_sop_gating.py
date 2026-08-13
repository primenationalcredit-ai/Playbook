import sys

f='netlify/functions/ai-sop.js'; s=open(f,encoding='utf-8',errors='surrogateescape').read()
if 'PHASE_ORDER' in s: print("SKIP 1/3")
else:
    a="    if (body.action === 'start' && body.card_id) {"
    if s.count(a)!=1: print("ABORT 1/3 start anchor x"+str(s.count(a))); sys.exit(1)
    s=s.replace(a, a+"""
      // PHASE GATE (Joe 8/13): the first real SOP documented features that did not
      // exist, because the card sat at BUILD and its plan field is a SPEC. An SOP
      // written before TESTING documents the plan, not the product. Warn once; the
      // panel can re-send with confirm:true to override.
      const PHASE_ORDER = ['PREPLAN','LAYOUT','BUILD','TESTING','SOP','LAUNCH','TRAINING','TRACKING'];
      if (!body.confirm) {
        const cr = await fetch(`${SU}/rest/v1/project_cards?id=eq.${encodeURIComponent(body.card_id)}&select=phase,steps`, { headers: H }).then(r => r.json()).catch(() => null);
        const c0 = Array.isArray(cr) && cr[0];
        if (c0) {
          const idx = PHASE_ORDER.indexOf(String(c0.phase || 'PREPLAN').toUpperCase());
          const steps = Array.isArray(c0.steps) ? c0.steps : [];
          const done = steps.filter(x => x && x.done).length;
          if (idx > -1 && idx < PHASE_ORDER.indexOf('SOP')) {
            return respond(200, { warn: `This project is still in ${PHASE_ORDER[idx]} with ${done} of ${steps.length} tasks done. An SOP written now documents the PLAN, not what is actually built - it will describe features that do not exist yet. Generate anyway?` });
          }
        }
      }""",1)
    open(f,'w',encoding='utf-8',errors='surrogateescape',newline='').write(s); print("1/3 ai-sop.js: phase gate")

f='netlify/functions/ai-sop-background.js'; s=open(f,encoding='utf-8',errors='surrogateescape').read()
if 'BUILT AND VERIFIED' in s: print("SKIP 2/3")
else:
    a="    const tasks = (card.steps || []).map((st, i) => (i + 1) + '. ' + st.text"
    if s.count(a)!=1: print("ABORT 2/3 tasks anchor x"+str(s.count(a))); sys.exit(1)
    s=s.replace(a, "    const tasks = (card.steps || []).map((st, i) => (i + 1) + '. [' + (st.done ? 'BUILT' : 'NOT BUILT YET') + '] ' + st.text",1)
    a="    const prompt = 'Write the official Standard Operating Procedure"
    if s.count(a)!=1: print("ABORT 2/3 prompt anchor x"+str(s.count(a))); sys.exit(1)
    s=s.replace(a, """    const allSteps = Array.isArray(card.steps) ? card.steps : [];
    const doneN = allSteps.filter(x => x && x.done).length;
    const phase = String(card.phase || 'PREPLAN').toUpperCase();
    const groundRule = 'GROUND RULE - THIS IS THE MOST IMPORTANT INSTRUCTION. This project is in phase ' + phase + ' with ' + doneN + ' of ' + allSteps.length + ' tasks complete. Every task below is marked [BUILT] or [NOT BUILT YET]. Document ONLY what is marked BUILT AND VERIFIED by that marker. The NOTES/PLAN field is a PLAN, not a description of reality - it names things that may not exist. Never describe a screen, button, menu item, or capability as existing unless a [BUILT] task establishes it. If an important part of the process is not built yet, either omit it entirely or name it once under a clearly labelled "Not Yet Available" heading at the end. An employee must never be sent looking for something that is not there.\\n\\n';
    const prompt = groundRule + 'Write the official Standard Operating Procedure""",1)
    open(f,'w',encoding='utf-8',errors='surrogateescape',newline='').write(s); print("2/3 ai-sop-background.js: build-state grounding")

f='src/pages/LeadershipProjects.jsx'; s=open(f,encoding='utf-8',errors='surrogateescape').read()
if 'sopConfirm' in s: print("SKIP 3/3")
else:
    a="      const st = await fetch('/.netlify/functions/ai-sop', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ action: 'start', card_id: card.id }) });\n      const sj = await st.json();\n      if (!st.ok || !sj.nonce) throw new Error(sj.error || 'start failed');"
    if s.count(a)!=1: print("ABORT 3/3 start-call anchor x"+str(s.count(a))); sys.exit(1)
    s=s.replace(a, """      const st = await fetch('/.netlify/functions/ai-sop', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ action: 'start', card_id: card.id, confirm: !!sopConfirmOverride }) });
      const sj = await st.json();
      // PHASE GATE (Joe 8/13): early-lifecycle cards get one honest warning first.
      if (sj.warn) { setSopConfirm(sj.warn); setSopBusy(false); return; }
      if (!st.ok || !sj.nonce) throw new Error(sj.error || 'start failed');""",1)
    a2="  const [sopDraft, setSopDraft] = useState(null);"
    if s.count(a2)!=1: print("ABORT 3/3 state anchor x"+str(s.count(a2))); sys.exit(1)
    s=s.replace(a2, a2+"\n  const [sopConfirm, setSopConfirm] = useState(null);",1)
    a3="        {sopDraft !== null && ("
    if s.count(a3)!=1: print("ABORT 3/3 modal anchor x"+str(s.count(a3))); sys.exit(1)
    s=s.replace(a3, """        {sopConfirm && (
          <div className="fixed inset-0 z-[75] bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="font-bold text-slate-800 mb-2">This project is not ready for an SOP</div>
              <div className="text-sm text-slate-600 mb-5">{sopConfirm}</div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setSopConfirm(null)} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Wait until it is built</button>
                <button onClick={() => { setSopConfirm(null); genSOP(true); }} className="px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700">Generate anyway</button>
              </div>
            </div>
          </div>
        )}
"""+a3,1)
    a4="  const genSOP = async () => {"
    if s.count(a4)!=1: print("ABORT 3/3 genSOP anchor x"+str(s.count(a4))); sys.exit(1)
    s=s.replace(a4, "  const genSOP = async (sopConfirmOverride) => {",1)
    open(f,'w',encoding='utf-8',errors='surrogateescape',newline='').write(s); print("3/3 LeadershipProjects.jsx: confirm dialog")
print("SOP PHASE GATING PATCHED")
