import sys
f = 'src/pages/LeadershipProjects.jsx'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
# 1) call site: pass currentUser + onSaveMeta, drop the popup
old_call = """      {openProjectId && (() => { const pc = cards.find(c => c.id === openProjectId); return pc ? (
        <ProjectDetail card={pc} stages={stages} leaders={leaders}
          onClose={() => setOpenProjectId(null)}
          onEditDetails={() => { setEditingCard(pc); setShowCardModal(true); }}
          onDelete={() => { deleteCard(pc.id); setOpenProjectId(null); }}
          onSaveSteps={async (steps) => {
            setCards(prev => prev.map(c => c.id === pc.id ? { ...c, steps } : c));
            await apiCall('project_cards', 'PATCH', { steps, updated_at: new Date().toISOString() }, `id=eq.${pc.id}`);
          }}
        />
      ) : null; })()}"""
new_call = """      {openProjectId && (() => { const pc = cards.find(c => c.id === openProjectId); return pc ? (
        <ProjectDetail card={pc} stages={stages} leaders={leaders} currentUser={currentUser}
          onClose={() => setOpenProjectId(null)}
          onDelete={() => { deleteCard(pc.id); setOpenProjectId(null); }}
          onSaveSteps={async (steps) => {
            setCards(prev => prev.map(c => c.id === pc.id ? { ...c, steps } : c));
            await apiCall('project_cards', 'PATCH', { steps, updated_at: new Date().toISOString() }, `id=eq.${pc.id}`);
          }}
          onSaveMeta={async (patch) => {
            setCards(prev => prev.map(c => c.id === pc.id ? { ...c, ...patch } : c));
            await apiCall('project_cards', 'PATCH', { ...patch, updated_at: new Date().toISOString() }, `id=eq.${pc.id}`);
          }}
        />
      ) : null; })()}"""
if s.count(old_call) != 1: print(f"ABORTED: call-site anchor x{s.count(old_call)}"); sys.exit(1)
s = s.replace(old_call, new_call, 1)
# 2) replace the whole ProjectDetail component by span (start comment -> CardModal)
start_marker = "// Full-page project view (Joe 8/11"
end_marker = "function CardModal({"
if s.count(start_marker) != 1 or s.count(end_marker) != 1:
    print(f"ABORTED: span markers x{s.count(start_marker)}/{s.count(end_marker)}"); sys.exit(1)
i1 = s.find(start_marker); i2 = s.find(end_marker)
comp = """// Full-page project view v2 (Joe 8/11): EVERYTHING edits inline on the page - no popup.
// Sections: header (all fields click-to-edit, autosave) / status & plan / UPDATES log /
// SOP & FILES links / TASKS spreadsheet grouped by month. Start-to-finish launch view.
function ProjectDetail({ card, stages, leaders, currentUser, onClose, onDelete, onSaveSteps, onSaveMeta }) {
  const [steps, setSteps] = useState(Array.isArray(card.steps) ? card.steps : []);
  const [meta, setMeta] = useState({ title: card.title || '', objective: card.objective || '', notes: card.notes || '',
    dependencies: card.dependencies || '', risks: card.risks || '', owner_name: card.owner_name || '',
    priority: card.priority || 'medium', stage_id: card.stage_id, target_start_date: card.target_start_date || '', due_date: card.due_date || '' });
  const [updates, setUpdates] = useState(Array.isArray(card.updates) ? card.updates : []);
  const [links, setLinks] = useState(Array.isArray(card.links) ? card.links : []);
  const [newUpdate, setNewUpdate] = useState('');
  const [newLink, setNewLink] = useState({ label: '', url: '' });
  const [newTask, setNewTask] = useState({ text: '', assignee: '', due: '' });
  const todayStr = new Date().toISOString().slice(0, 10);
  const doneCount = steps.filter(st => st.done).length;
  const pct = steps.length ? Math.round((doneCount / steps.length) * 100) : 0;
  const stage = stages.find(st => st.id === meta.stage_id);
  const saveSteps = (next) => { setSteps(next); onSaveSteps(next); };
  const setM = (fld, v) => setMeta(p => ({ ...p, [fld]: v }));
  const commit = (fld) => { if ((card[fld] || '') !== (meta[fld] || '')) onSaveMeta({ [fld]: meta[fld] === '' ? null : meta[fld] }); };
  const commitNow = (fld, v) => { setM(fld, v); onSaveMeta({ [fld]: v === '' ? null : v }); };
  const setField = (i, fld, v) => saveSteps(steps.map((st, j) => j === i ? { ...st, [fld]: v } : st));
  const toggle = (i) => saveSteps(steps.map((st, j) => j === i ? { ...st, done: !st.done, done_by: !st.done ? (currentUser?.name || '') : st.done_by, done_at: !st.done ? new Date().toISOString() : null } : st));
  const removeTask = (i) => { if (confirm('Remove this task?')) saveSteps(steps.filter((_, j) => j !== i)); };
  const addTask = () => { const t = newTask.text.trim(); if (!t) return;
    saveSteps([...steps, { text: t, assignee: newTask.assignee || '', due: newTask.due || '', done: false }]);
    setNewTask({ text: '', assignee: '', due: '' }); };
  const addUpdate = () => { const t = newUpdate.trim(); if (!t) return;
    const next = [{ text: t, by: currentUser?.name || 'Unknown', at: new Date().toISOString() }, ...updates];
    setUpdates(next); onSaveMeta({ updates: next }); setNewUpdate(''); };
  const removeUpdate = (i) => { if (!confirm('Remove this update?')) return;
    const next = updates.filter((_, j) => j !== i); setUpdates(next); onSaveMeta({ updates: next }); };
  const addLink = () => { const u = newLink.url.trim(); if (!u) return;
    const next = [...links, { label: newLink.label.trim() || u, url: u.startsWith('http') ? u : 'https://' + u }];
    setLinks(next); onSaveMeta({ links: next }); setNewLink({ label: '', url: '' }); };
  const removeLink = (i) => { const next = links.filter((_, j) => j !== i); setLinks(next); onSaveMeta({ links: next }); };
  const chip = (st) => {
    if (st.done) return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">Done{st.done_by ? ` - ${String(st.done_by).split(' ')[0]}` : ''}</span>;
    if (st.due && st.due < todayStr) return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700">Overdue</span>;
    if (st.due && st.due <= new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)) return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">Due soon</span>;
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500">Upcoming</span>;
  };
  const monthOf = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'No date set';
  const fmtWhen = (iso) => { try { return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch (e) { return ''; } };
  const inputCls = "bg-transparent border border-transparent hover:border-slate-200 focus:border-asap-blue rounded px-2 py-1 focus:outline-none";
  return (
    <div className="fixed inset-0 bg-slate-50 z-40 overflow-y-auto">
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <button onClick={onClose} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-medium"><X className="w-5 h-5" /> Back to board</button>
          <button onClick={onDelete} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg hover:bg-rose-50 text-sm font-medium text-rose-600"><Trash2 className="w-4 h-4" /> Delete project</button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-4">
          <input value={meta.title} onChange={(e) => setM('title', e.target.value)} onBlur={() => commit('title')}
            className="text-2xl font-bold text-slate-800 w-full bg-transparent border-b-2 border-transparent hover:border-slate-200 focus:border-asap-blue focus:outline-none mb-3" />
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-600 mb-3">
            <label className="flex items-center gap-1.5">Stage:
              <select value={meta.stage_id || ''} onChange={(e) => commitNow('stage_id', e.target.value)} className={inputCls + ' font-semibold'} style={{ color: stage?.color }}>
                {stages.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
              </select></label>
            <label className="flex items-center gap-1.5">Priority:
              <select value={meta.priority} onChange={(e) => commitNow('priority', e.target.value)} className={inputCls + ' font-semibold capitalize'}>
                <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
              </select></label>
            <label className="flex items-center gap-1.5"><User className="w-4 h-4 text-slate-400" /> Owner:
              <input type="text" list="pd-assignees" value={meta.owner_name} onChange={(e) => setM('owner_name', e.target.value)} onBlur={() => commit('owner_name')} className={inputCls + ' w-36 font-semibold'} /></label>
            <label className="flex items-center gap-1.5"><Calendar className="w-4 h-4 text-slate-400" /> Start:
              <input type="date" value={meta.target_start_date || ''} onChange={(e) => commitNow('target_start_date', e.target.value)} className={inputCls} /></label>
            <label className="flex items-center gap-1.5"><Flag className="w-4 h-4 text-slate-400" /> Deadline:
              <input type="date" value={meta.due_date || ''} onChange={(e) => commitNow('due_date', e.target.value)} className={inputCls + (meta.due_date && meta.due_date < todayStr ? ' text-rose-600 font-semibold' : '')} /></label>
            <span className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-slate-400" /> <b>{doneCount}/{steps.length}</b> done</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2.5 mb-4">
            <div className="bg-asap-blue h-2.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="text-xs font-bold text-slate-400 uppercase mb-1">Objective</div>
          <textarea value={meta.objective} onChange={(e) => setM('objective', e.target.value)} onBlur={() => commit('objective')} rows={2}
            placeholder="What does done look like?" className="w-full text-slate-700 bg-transparent border border-transparent hover:border-slate-200 focus:border-asap-blue rounded-lg p-2 focus:outline-none resize-none mb-3" />
          <div className="text-xs font-bold text-slate-400 uppercase mb-1">Status &amp; Plan</div>
          <textarea value={meta.notes} onChange={(e) => setM('notes', e.target.value)} onBlur={() => commit('notes')} rows={10}
            placeholder="Where we are, what's next, deadline table..." className="w-full text-sm text-slate-600 bg-slate-50 border border-slate-100 hover:border-slate-200 focus:border-asap-blue rounded-xl p-4 focus:outline-none" />
          <div className="grid md:grid-cols-2 gap-3 mt-3 text-sm">
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
              <b className="text-amber-800">Dependencies</b>
              <textarea value={meta.dependencies} onChange={(e) => setM('dependencies', e.target.value)} onBlur={() => commit('dependencies')} rows={2}
                className="w-full bg-transparent text-amber-900 focus:outline-none resize-none mt-1" placeholder="What this waits on..." />
            </div>
            <div className="bg-rose-50 border border-rose-100 rounded-xl p-3">
              <b className="text-rose-800">Risks</b>
              <textarea value={meta.risks} onChange={(e) => setM('risks', e.target.value)} onBlur={() => commit('risks')} rows={2}
                className="w-full bg-transparent text-rose-900 focus:outline-none resize-none mt-1" placeholder="What could go wrong..." />
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <h2 className="font-bold text-slate-800 mb-3">Updates</h2>
            <div className="flex gap-2 mb-3">
              <input type="text" value={newUpdate} onChange={(e) => setNewUpdate(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addUpdate(); } }}
                placeholder="Post an update..." className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-asap-blue" />
              <button onClick={addUpdate} className="px-3 py-2 bg-asap-blue text-white rounded-lg hover:bg-asap-blue-dark text-sm font-medium">Post</button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {updates.length === 0 && <div className="text-sm text-slate-400">No updates yet - post progress notes here so the whole team sees the latest.</div>}
              {updates.map((u, i) => (
                <div key={i} className="group bg-slate-50 rounded-lg p-2.5 text-sm">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-0.5">
                    <span><b className="text-slate-600">{u.by}</b> - {fmtWhen(u.at)}</span>
                    <button onClick={() => removeUpdate(i)} className="opacity-0 group-hover:opacity-100 hover:text-rose-500">{'\\u2715'}</button>
                  </div>
                  <div className="text-slate-700 whitespace-pre-wrap">{u.text}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <h2 className="font-bold text-slate-800 mb-3">SOP &amp; Files</h2>
            <div className="flex flex-wrap gap-2 mb-3">
              <input type="text" value={newLink.label} onChange={(e) => setNewLink(p => ({ ...p, label: e.target.value }))}
                placeholder="Name (e.g. SOP v2)" className="w-36 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-asap-blue" />
              <input type="text" value={newLink.url} onChange={(e) => setNewLink(p => ({ ...p, url: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }}
                placeholder="Paste link (Drive, Docs, Loom...)" className="flex-1 min-w-[160px] border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-asap-blue" />
              <button onClick={addLink} className="px-3 py-2 bg-asap-blue text-white rounded-lg hover:bg-asap-blue-dark text-sm font-medium">Add</button>
            </div>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {links.length === 0 && <div className="text-sm text-slate-400">Attach the SOP, training videos, Loom walkthroughs, and any docs - one link each.</div>}
              {links.map((l, i) => (
                <div key={i} className="group flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 text-sm">
                  <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                  <a href={l.url} target="_blank" rel="noreferrer" className="flex-1 text-asap-blue hover:underline truncate">{l.label}</a>
                  <button onClick={() => removeLink(i)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500">{'\\u2715'}</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-bold text-slate-800">Tasks &amp; Timeline</h2>
            <span className="text-sm text-slate-500">{doneCount} done - {steps.filter(st => !st.done && st.due && st.due < todayStr).length} overdue - {steps.length - doneCount} open</span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr><th className="w-10 px-3 py-2"></th><th className="text-left px-3 py-2">Task</th><th className="text-left px-3 py-2 w-44">Assignee</th><th className="text-left px-3 py-2 w-36">Due date</th><th className="text-left px-3 py-2 w-32">Status</th><th className="w-10 px-3 py-2"></th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(() => { const els = []; let lastM = null;
                steps.forEach((st, i) => {
                  const m = monthOf(st.due);
                  if (m !== lastM) { lastM = m;
                    els.push(<tr key={`m-${i}`} className="bg-slate-100/70"><td colSpan={6} className="px-4 py-1.5 text-xs font-bold text-slate-500 uppercase tracking-wide">{m}</td></tr>); }
                  els.push(
                    <tr key={i} className={st.done ? 'bg-slate-50/60' : 'hover:bg-slate-50'}>
                      <td className="px-3 py-2 text-center"><input type="checkbox" checked={!!st.done} onChange={() => toggle(i)} className="w-4 h-4" /></td>
                      <td className={`px-3 py-2 ${st.done ? 'line-through text-slate-400' : 'text-slate-700'}`}>{st.text}</td>
                      <td className="px-3 py-2"><input type="text" list="pd-assignees" value={st.assignee || st.done_by || ''} onChange={(e) => setField(i, 'assignee', e.target.value)} placeholder="Assign..." className={inputCls + ' w-full'} /></td>
                      <td className="px-3 py-2"><input type="date" value={st.due || ''} onChange={(e) => setField(i, 'due', e.target.value)} className={inputCls} /></td>
                      <td className="px-3 py-2">{chip(st)}</td>
                      <td className="px-3 py-2 text-center"><button onClick={() => removeTask(i)} className="text-slate-300 hover:text-rose-500"><Trash2 className="w-4 h-4" /></button></td>
                    </tr>);
                }); return els; })()}
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

"""
s = s[:i1] + comp + s[i2:]
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
print("ProjectDetail v2: inline everything + updates + SOP links + month timeline")
