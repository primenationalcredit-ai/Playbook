import sys
f = 'src/pages/LeadershipProjects.jsx'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
# 1) call site: remount on data change + onReload
a1 = "        <ProjectDetail card={pc} stages={stages} leaders={leaders} currentUser={currentUser}"
if s.count(a1) != 1: print(f"ABORTED: callsite anchor x{s.count(a1)}"); sys.exit(1)
s = s.replace(a1, "        <ProjectDetail key={pc.updated_at || pc.id} card={pc} stages={stages} leaders={leaders} currentUser={currentUser} onReload={() => loadData()}", 1)
# 2) assistant panel component + signature gains onReload
a2 = "function ProjectDetail({ card, stages, leaders, currentUser, onClose, onDelete, onSaveSteps, onSaveMeta }) {"
if s.count(a2) != 1: print(f"ABORTED: signature anchor x{s.count(a2)}"); sys.exit(1)
comp = """// PHASE B - per-project AI assistant (Joe 8/11): the same brain pointed at an
// existing card. "Push testing out two days" / "add a task for X" / "mark layout
// done" - it edits the card server-side and the page reloads with the changes.
function ProjectAIPanel({ card, onClose, onChanged }) {
  const [msgs, setMsgs] = useState([{ role: 'assistant', local: true, content: `I'm managing "${card.title}" with you. Ask me anything about it, or tell me what to change - dates, tasks, subtasks, phases, updates - and I'll do it.` }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = React.useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, busy]);
  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const next = [...msgs, { role: 'user', content: text }];
    setMsgs(next); setInput(''); setBusy(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess && sess.session && sess.session.access_token;
      const res = await fetch('/.netlify/functions/ai-project-assistant', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ card_id: card.id, messages: next.filter(m => !m.local).map(m => ({ role: m.role, content: m.content })) })
      });
      const j = await res.json();
      if (!res.ok) setMsgs(p => [...p, { role: 'assistant', content: `Error: ${j.error || res.status}` }]);
      else {
        setMsgs(p => [...p, { role: 'assistant', content: (j.reply || '(no reply)') + (j.applied ? `\\n\\n(${j.applied} change${j.applied === 1 ? '' : 's'} applied - refreshing the page data now)` : '') }]);
        if (j.applied) setTimeout(() => onChanged(), 800);
      }
    } catch (e) { setMsgs(p => [...p, { role: 'assistant', content: `Error: ${e.message}` }]); }
    setBusy(false);
  };
  return (
    <div className="fixed right-6 bottom-6 z-50 w-[26rem] max-w-[92vw] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden" style={{ height: '32rem' }}>
      <div className="px-4 py-3 flex items-center justify-between bg-gradient-to-r from-violet-600 to-asap-blue text-white">
        <div className="font-bold text-sm">{'\\u2728'} AI Project Manager</div>
        <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg"><X className="w-4 h-4" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[90%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-asap-blue text-white' : 'bg-white border border-slate-200 text-slate-700'}`}>{m.content}</div>
          </div>
        ))}
        {busy && <div className="flex justify-start"><div className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-400">working{'\\u2026'}</div></div>}
        <div ref={endRef} />
      </div>
      <div className="p-2.5 border-t border-slate-200 flex gap-2 bg-white">
        <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={2}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Ask or instruct... (Enter to send)"
          className="flex-1 border border-slate-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-asap-blue resize-none" />
        <button onClick={send} disabled={busy} className="px-4 bg-asap-blue text-white rounded-xl text-sm font-medium hover:bg-asap-blue-dark disabled:opacity-50">Send</button>
      </div>
    </div>
  );
}

function ProjectDetail({ card, stages, leaders, currentUser, onClose, onDelete, onSaveSteps, onSaveMeta, onReload }) {"""
s = s.replace(a2, comp, 1)
# 3) state for phase + panel toggle
a3 = "  const [updates, setUpdates] = useState(Array.isArray(card.updates) ? card.updates : []);"
if s.count(a3) != 1: print(f"ABORTED: state anchor x{s.count(a3)}"); sys.exit(1)
s = s.replace(a3, a3 + """
  const [aiPanel, setAiPanel] = useState(false); // PHASE B assistant
  const phase = card.phase || 'PREPLAN';
  const PHASES = ['PREPLAN','LAYOUT','BUILD','TESTING','SOP','LAUNCH','TRAINING','TRACKING'];""", 1)
# 4) AI button next to Delete
a4 = """          <button onClick={onDelete} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg hover:bg-rose-50 text-sm font-medium text-rose-600"><Trash2 className="w-4 h-4" /> Delete project</button>"""
if s.count(a4) != 1: print(f"ABORTED: delete-btn anchor x{s.count(a4)}"); sys.exit(1)
s = s.replace(a4, """          <div className="flex items-center gap-2">
            <button onClick={() => setAiPanel(true)} className="flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-violet-600 to-asap-blue text-white rounded-lg hover:opacity-90 text-sm font-medium">{'\\u2728'} AI Project Manager</button>
            <button onClick={onDelete} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg hover:bg-rose-50 text-sm font-medium text-rose-600"><Trash2 className="w-4 h-4" /> Delete project</button>
          </div>""", 1)
# 5) lifecycle strip above the Objective label + panel render
a5 = """          <div className="text-xs font-bold text-slate-400 uppercase mb-1">Objective</div>"""
if s.count(a5) != 1: print(f"ABORTED: objective anchor x{s.count(a5)}"); sys.exit(1)
s = s.replace(a5, """          <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1">
            {PHASES.map((ph, i) => {
              const cur = PHASES.indexOf(phase);
              const state = i < cur ? 'past' : i === cur ? 'current' : 'future';
              return (
                <React.Fragment key={ph}>
                  {i > 0 && <div className={`h-0.5 w-3 shrink-0 ${state === 'future' ? 'bg-slate-200' : 'bg-asap-blue'}`} />}
                  <button onClick={() => onSaveMeta({ phase: ph })}
                    title={state === 'current' ? 'Current phase' : `Set phase to ${ph}`}
                    className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide transition-all ${state === 'current' ? 'bg-asap-blue text-white shadow' : state === 'past' ? 'bg-blue-50 text-asap-blue' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
                    {state === 'past' ? '\\u2713 ' : ''}{ph}
                  </button>
                </React.Fragment>
              );
            })}
          </div>
          {aiPanel && <ProjectAIPanel card={card} onClose={() => setAiPanel(false)} onChanged={() => { setAiPanel(false); onReload(); }} />}
          <div className="text-xs font-bold text-slate-400 uppercase mb-1">Objective</div>""", 1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
print("Phase B UI: lifecycle strip + per-project AI assistant")
