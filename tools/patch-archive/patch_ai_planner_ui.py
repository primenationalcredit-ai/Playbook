import sys, re
f = 'src/pages/LeadershipProjects.jsx'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
# 0) supabase import: copy the exact import line ClientFile uses (path certainty)
cf = open('src/pages/ClientFile.jsx', encoding='utf-8', errors='surrogateescape').read()
mm = re.search(r"^import \{[^}]*supabase[^}]*\} from ['\"][^'\"]+['\"];?\s*$", cf, re.M)
if not mm: print("ABORTED: supabase import not found in ClientFile"); sys.exit(1)
sup_import = mm.group(0).strip()
if 'supabase' not in s.split('\n')[0:40].__str__() or sup_import not in s:
    a0 = "import { format, isPast, isToday, differenceInDays } from 'date-fns';"
    if s.count(a0) != 1: print(f"ABORTED: import anchor x{s.count(a0)}"); sys.exit(1)
    s = s.replace(a0, a0 + "\n" + sup_import, 1)
# 1) state
a1 = "  const [openProjectId, setOpenProjectId] = useState(null); // full-page project view (Joe 8/11)"
if s.count(a1) != 1: print(f"ABORTED: state anchor x{s.count(a1)}"); sys.exit(1)
s = s.replace(a1, a1 + "\n  const [aiOpen, setAiOpen] = useState(false); // PHASE A: Create-with-AI interview panel", 1)
# 2) button next to New Project
a2 = """            <button
              onClick={() => { setEditingCard(null); setShowCardModal(true); }}"""
if s.count(a2) != 1: print(f"ABORTED: button anchor x{s.count(a2)}"); sys.exit(1)
s = s.replace(a2, """            <button
              onClick={() => setAiOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-asap-blue text-white rounded-lg hover:opacity-90 font-medium"
            >
              {'\\u2728'} Create with AI
            </button>
            <button
              onClick={() => { setEditingCard(null); setShowCardModal(true); }}""", 1)
# 3) render the panel
a3 = """      ) : null; })()}"""
if s.count(a3) != 1: print(f"ABORTED: render anchor x{s.count(a3)}"); sys.exit(1)
s = s.replace(a3, a3 + """

      {aiOpen && <AIPlannerPanel onClose={() => setAiOpen(false)} onCreated={() => loadData()} />}""", 1)
# 4) the panel component before ProjectDetail
a4 = "function ProjectDetail({"
if s.count(a4) != 1: print(f"ABORTED: component anchor x{s.count(a4)}"); sys.exit(1)
comp = """// PHASE A - AI Project Manager interview panel (Joe 8/11): leadership describes a
// project in plain language; the AI asks questions, summarizes, and on approval
// creates the fully structured project card itself.
function AIPlannerPanel({ onClose, onCreated }) {
  const GREETING = { role: 'assistant', local: true, content: "Tell me about the project you want to build - what should it do, and why? I'll ask questions until I have everything, show you a summary, and once you approve it I'll create the whole project with phases, tasks, owners, and dates." };
  const [msgs, setMsgs] = useState([GREETING]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(null);
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
      const res = await fetch('/.netlify/functions/ai-project-planner', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: next.filter(m => !m.local).map(m => ({ role: m.role, content: m.content })) })
      });
      const j = await res.json();
      if (!res.ok) { setMsgs(p => [...p, { role: 'assistant', content: `Error: ${j.error || res.status}` }]); }
      else {
        setMsgs(p => [...p, { role: 'assistant', content: j.reply || '(no reply)' }]);
        if (j.created) { setCreated(j.created); onCreated(); }
      }
    } catch (e) { setMsgs(p => [...p, { role: 'assistant', content: `Error: ${e.message}` }]); }
    setBusy(false);
  };
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl h-[85vh] flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-violet-600 to-asap-blue text-white">
          <div className="font-bold">{'\\u2728'} AI Project Manager</div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
          {msgs.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-asap-blue text-white' : 'bg-white border border-slate-200 text-slate-700'}`}>{m.content}</div>
            </div>
          ))}
          {busy && <div className="flex justify-start"><div className="bg-white border border-slate-200 rounded-2xl px-4 py-2.5 text-sm text-slate-400">thinking{'\\u2026'}</div></div>}
          {created && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-800">
              <b>{'\\u2705'} Project created:</b> {created.title} - {created.tasks} tasks{created.due ? `, due ${created.due}` : ''}. It's on the board now.
            </div>
          )}
          <div ref={endRef} />
        </div>
        <div className="p-3 border-t border-slate-200 flex gap-2 bg-white">
          <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={2}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={created ? 'Project created - close this panel, or describe another project' : 'Describe the project... (Enter to send, Shift+Enter for a new line)'}
            className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-asap-blue resize-none" />
          <button onClick={send} disabled={busy} className="px-5 bg-asap-blue text-white rounded-xl font-medium hover:bg-asap-blue-dark disabled:opacity-50">Send</button>
        </div>
      </div>
    </div>
  );
}

function ProjectDetail({"""
s = s.replace(a4, comp, 1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
print("Create-with-AI panel wired in")
