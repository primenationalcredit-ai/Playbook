import sys
f = 'src/pages/LeadershipProjects.jsx'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
reps = []
# 1) state for the open project
reps.append((
"""  const [showStageModal, setShowStageModal] = useState(false);
  const [editingStage, setEditingStage] = useState(null);""",
"""  const [showStageModal, setShowStageModal] = useState(false);
  const [editingStage, setEditingStage] = useState(null);
  const [openProjectId, setOpenProjectId] = useState(null); // full-page project view (Joe 8/11)"""))
# 2) kanban card click -> open full page
reps.append((
"""onEdit={() => { setEditingCard(card); setShowCardModal(true); }}""",
"""onEdit={() => setOpenProjectId(card.id)}"""))
# 3) list view click -> open full page
reps.append((
"""onClick={() => { setEditingCard(card); setShowCardModal(true); }}""",
"""onClick={() => setOpenProjectId(card.id)}"""))
# 4) render the detail overlay
reps.append((
"""          onClose={() => { setShowCardModal(false); setEditingCard(null); }}
        />
      )}""",
"""          onClose={() => { setShowCardModal(false); setEditingCard(null); }}
        />
      )}

      {openProjectId && (() => { const pc = cards.find(c => c.id === openProjectId); return pc ? (
        <ProjectDetail card={pc} stages={stages} leaders={leaders}
          onClose={() => setOpenProjectId(null)}
          onEditDetails={() => { setEditingCard(pc); setShowCardModal(true); }}
          onDelete={() => { deleteCard(pc.id); setOpenProjectId(null); }}
          onSaveSteps={async (steps) => {
            setCards(prev => prev.map(c => c.id === pc.id ? { ...c, steps } : c));
            await apiCall('project_cards', 'PATCH', { steps, updated_at: new Date().toISOString() }, `id=eq.${pc.id}`);
          }}
        />
      ) : null; })()}"""))
for old, new in reps:
    if s.count(old) != 1: print(f"ABORTED: anchor x{s.count(old)}: {old[:70]!r}"); sys.exit(1)
    s = s.replace(old, new, 1)
# 5) the ProjectDetail component itself
comp = """
// Full-page project view (Joe 8/11: "take a sheet out of the top project management apps").
// Spreadsheet-style task table: every task carries its own assignee + due date, inline
// editable, autosaved. Status chips computed from due dates.
function ProjectDetail({ card, stages, leaders, onClose, onEditDetails, onDelete, onSaveSteps }) {
  const [steps, setSteps] = useState(Array.isArray(card.steps) ? card.steps : []);
  const [newTask, setNewTask] = useState({ text: '', assignee: '', due: '' });
  const stage = stages.find(st => st.id === card.stage_id);
  const todayStr = new Date().toISOString().slice(0, 10);
  const doneCount = steps.filter(st => st.done).length;
  const pct = steps.length ? Math.round((doneCount / steps.length) * 100) : 0;
  const save = (next) => { setSteps(next); onSaveSteps(next); };
  const setField = (i, field, value) => save(steps.map((st, j) => j === i ? { ...st, [field]: value } : st));
  const toggle = (i) => save(steps.map((st, j) => j === i ? { ...st, done: !st.done, done_at: !st.done ? new Date().toISOString() : null } : st));
  const remove = (i) => { if (confirm('Remove this task?')) save(steps.filter((_, j) => j !== i)); };
  const addTask = () => {
    const t = newTask.text.trim(); if (!t) return;
    save([...steps, { text: t, assignee: newTask.assignee || '', due: newTask.due || '', done: false }]);
    setNewTask({ text: '', assignee: '', due: '' });
  };
  const chip = (st) => {
    if (st.done) return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">Done{st.done_by ? ` - ${String(st.done_by).split(' ')[0]}` : ''}</span>;
    if (st.due && st.due < todayStr) return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700">Overdue</span>;
    if (st.due && st.due <= new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)) return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">Due soon</span>;
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500">Upcoming</span>;
  };
  const prioColor = { high: 'bg-rose-100 text-rose-700', medium: 'bg-amber-100 text-amber-700', low: 'bg-slate-100 text-slate-600' }[card.priority] || 'bg-slate-100 text-slate-600';
  return (
    <div className="fixed inset-0 bg-slate-50 z-40 overflow-y-auto">
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <button onClick={onClose} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-medium">
            <X className="w-5 h-5" /> Back to board
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onEditDetails} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 text-sm font-medium"><Edit3 className="w-4 h-4" /> Edit details</button>
            <button onClick={onDelete} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg hover:bg-rose-50 text-sm font-medium text-rose-600"><Trash2 className="w-4 h-4" /> Delete</button>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-4">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <h1 className="text-2xl font-bold text-slate-800">{card.title}</h1>
            {stage && <span className="px-2.5 py-1 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: stage.color }}>{stage.name}</span>}
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${prioColor}`}>{card.priority} priority</span>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600 mb-4">
            {card.owner_name && <span className="flex items-center gap-1.5"><User className="w-4 h-4 text-slate-400" /> Owner: <b>{card.owner_name}</b></span>}
            {card.target_start_date && <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4 text-slate-400" /> Start: <b>{card.target_start_date}</b></span>}
            {card.due_date && <span className="flex items-center gap-1.5"><Flag className="w-4 h-4 text-slate-400" /> Deadline: <b className={card.due_date < todayStr ? 'text-rose-600' : ''}>{card.due_date}</b></span>}
            <span className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-slate-400" /> <b>{doneCount}/{steps.length}</b> tasks done</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2.5 mb-4">
            <div className="bg-asap-blue h-2.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          {card.objective && <p className="text-slate-700 mb-3"><b>Objective:</b> {card.objective}</p>}
          {card.notes && <div className="text-sm text-slate-600 whitespace-pre-wrap bg-slate-50 rounded-xl p-4 border border-slate-100">{card.notes}</div>}
          {(card.dependencies || card.risks) && (
            <div className="grid md:grid-cols-2 gap-3 mt-3 text-sm">
              {card.dependencies && <div className="bg-amber-50 border border-amber-100 rounded-xl p-3"><b className="text-amber-800">Dependencies:</b> <span className="text-amber-900">{card.dependencies}</span></div>}
              {card.risks && <div className="bg-rose-50 border border-rose-100 rounded-xl p-3"><b className="text-rose-800">Risks:</b> <span className="text-rose-900">{card.risks}</span></div>}
            </div>
          )}
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-bold text-slate-800">Tasks</h2>
            <span className="text-sm text-slate-500">{doneCount} done - {steps.filter(st => !st.done && st.due && st.due < todayStr).length} overdue - {steps.length - doneCount} open</span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="w-10 px-3 py-2"></th>
                <th className="text-left px-3 py-2">Task</th>
                <th className="text-left px-3 py-2 w-44">Assignee</th>
                <th className="text-left px-3 py-2 w-36">Due date</th>
                <th className="text-left px-3 py-2 w-32">Status</th>
                <th className="w-10 px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {steps.map((st, i) => (
                <tr key={i} className={st.done ? 'bg-slate-50/60' : 'hover:bg-slate-50'}>
                  <td className="px-3 py-2 text-center"><input type="checkbox" checked={!!st.done} onChange={() => toggle(i)} className="w-4 h-4" /></td>
                  <td className={`px-3 py-2 ${st.done ? 'line-through text-slate-400' : 'text-slate-700'}`}>{st.text}</td>
                  <td className="px-3 py-2">
                    <input type="text" list="pd-assignees" value={st.assignee || st.done_by || ''} onChange={(e) => setField(i, 'assignee', e.target.value)}
                      placeholder="Assign..." className="w-full bg-transparent border border-transparent hover:border-slate-200 focus:border-asap-blue rounded px-2 py-1 focus:outline-none" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="date" value={st.due || ''} onChange={(e) => setField(i, 'due', e.target.value)}
                      className="bg-transparent border border-transparent hover:border-slate-200 focus:border-asap-blue rounded px-2 py-1 focus:outline-none" />
                  </td>
                  <td className="px-3 py-2">{chip(st)}</td>
                  <td className="px-3 py-2 text-center"><button onClick={() => remove(i)} className="text-slate-300 hover:text-rose-500"><Trash2 className="w-4 h-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <datalist id="pd-assignees">
            {leaders.map(l => <option key={l.id} value={l.name} />)}
            <option value="Leadership" /><option value="Astrid + AMs" /><option value="Build (Joe + Claude)" /><option value="Joe + Claude" />
          </datalist>
          <div className="px-6 py-4 border-t border-slate-200 flex flex-wrap gap-2 items-center bg-slate-50">
            <input type="text" value={newTask.text} onChange={(e) => setNewTask(p => ({ ...p, text: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTask(); } }}
              placeholder="Add a task..." className="flex-1 min-w-[220px] border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-asap-blue" />
            <input type="text" list="pd-assignees" value={newTask.assignee} onChange={(e) => setNewTask(p => ({ ...p, assignee: e.target.value }))}
              placeholder="Assignee" className="w-40 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-asap-blue" />
            <input type="date" value={newTask.due} onChange={(e) => setNewTask(p => ({ ...p, due: e.target.value }))}
              className="border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-asap-blue" />
            <button onClick={addTask} className="flex items-center gap-1.5 px-4 py-2 bg-asap-blue text-white rounded-lg hover:bg-asap-blue-dark font-medium"><Plus className="w-4 h-4" /> Add</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CardModal({"""
old5 = "function CardModal({"
if s.count(old5) != 1: print(f"ABORTED: CardModal anchor x{s.count(old5)}"); sys.exit(1)
s = s.replace(old5, comp, 1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
print("full-page ProjectDetail in")
