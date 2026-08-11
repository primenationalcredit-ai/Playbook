import sys
f = 'src/pages/LeadershipProjects.jsx'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
# 1) state + subtask helpers
a1 = """  const [newTask, setNewTask] = useState({ text: '', assignee: '', due: '' });"""
if s.count(a1) != 1: print(f"ABORTED: a1 x{s.count(a1)}"); sys.exit(1)
s = s.replace(a1, a1 + """
  const [expanded, setExpanded] = useState(null); // which task row is open (Joe 8/11: tasks open up - subtasks, instructions, test links)
  const [newSub, setNewSub] = useState('');
  const addSub = (i) => { const t = newSub.trim(); if (!t) return; setField(i, 'subtasks', [...(steps[i].subtasks || []), { text: t, done: false }]); setNewSub(''); };
  const toggleSub = (i, j) => setField(i, 'subtasks', (steps[i].subtasks || []).map((sb, k) => k === j ? { ...sb, done: !sb.done, done_by: !sb.done ? (currentUser?.name || '') : null } : sb));
  const removeSub = (i, j) => setField(i, 'subtasks', (steps[i].subtasks || []).filter((_, k) => k !== j));""", 1)
# 2) row rendering -> expandable
a2 = """                  els.push(
                    <tr key={i} className={st.done ? 'bg-slate-50/60' : 'hover:bg-slate-50'}>
                      <td className="px-3 py-2 text-center"><input type="checkbox" checked={!!st.done} onChange={() => toggle(i)} className="w-4 h-4" /></td>
                      <td className={`px-3 py-2 ${st.done ? 'line-through text-slate-400' : 'text-slate-700'}`}>{st.text}</td>
                      <td className="px-3 py-2"><input type="text" list="pd-assignees" value={st.assignee || st.done_by || ''} onChange={(e) => setField(i, 'assignee', e.target.value)} placeholder="Assign..." className={inputCls + ' w-full'} /></td>
                      <td className="px-3 py-2"><input type="date" value={st.due || ''} onChange={(e) => setField(i, 'due', e.target.value)} className={inputCls} /></td>
                      <td className="px-3 py-2">{chip(st)}</td>
                      <td className="px-3 py-2 text-center"><button onClick={() => removeTask(i)} className="text-slate-300 hover:text-rose-500"><Trash2 className="w-4 h-4" /></button></td>
                    </tr>);"""
if s.count(a2) != 1: print(f"ABORTED: a2 x{s.count(a2)}"); sys.exit(1)
new2 = """                  const subs = st.subtasks || [];
                  els.push(
                    <tr key={i} className={st.done ? 'bg-slate-50/60' : 'hover:bg-slate-50'}>
                      <td className="px-3 py-2 text-center"><input type="checkbox" checked={!!st.done} onChange={() => toggle(i)} className="w-4 h-4" /></td>
                      <td className={`px-3 py-2 ${st.done ? 'text-slate-400' : 'text-slate-700'}`}>
                        <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => { setExpanded(expanded === i ? null : i); setNewSub(''); }}>
                          <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${expanded === i ? '' : '-rotate-90'}`} />
                          <span className={st.done ? 'line-through' : ''}>{st.text}</span>
                          {subs.length > 0 && <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0">{subs.filter(x => x.done).length}/{subs.length}</span>}
                          {st.test_url && <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-asap-blue shrink-0">test link</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2"><input type="text" list="pd-assignees" value={st.assignee || st.done_by || ''} onChange={(e) => setField(i, 'assignee', e.target.value)} placeholder="Assign..." className={inputCls + ' w-full'} /></td>
                      <td className="px-3 py-2"><input type="date" value={st.due || ''} onChange={(e) => setField(i, 'due', e.target.value)} className={inputCls} /></td>
                      <td className="px-3 py-2">{chip(st)}</td>
                      <td className="px-3 py-2 text-center"><button onClick={() => removeTask(i)} className="text-slate-300 hover:text-rose-500"><Trash2 className="w-4 h-4" /></button></td>
                    </tr>);
                  if (expanded === i) els.push(
                    <tr key={`x-${i}`} className="bg-blue-50/30">
                      <td className="border-l-4 border-asap-blue"></td>
                      <td colSpan={5} className="px-3 py-4">
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <div className="text-xs font-bold text-slate-400 uppercase mb-1">What to do</div>
                            <textarea value={st.details || ''} onChange={(e) => setField(i, 'details', e.target.value)} rows={4}
                              placeholder="Exact instructions - what does doing this task look like, step by step?"
                              className="w-full text-sm border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:border-asap-blue bg-white" />
                            <div className="text-xs font-bold text-slate-400 uppercase mt-3 mb-1">Test link</div>
                            <div className="flex gap-2">
                              <input type="text" value={st.test_url || ''} onChange={(e) => setField(i, 'test_url', e.target.value)}
                                placeholder="https://... (the page to test)"
                                className="flex-1 text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-asap-blue bg-white" />
                              {st.test_url && <a href={st.test_url} target="_blank" rel="noreferrer" className="px-3 py-1.5 bg-asap-blue text-white rounded-lg text-sm font-medium hover:bg-asap-blue-dark">Open</a>}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-400 uppercase mb-1">Subtasks ({subs.filter(x => x.done).length}/{subs.length})</div>
                            <div className="space-y-1 max-h-40 overflow-y-auto">
                              {subs.length === 0 && <div className="text-xs text-slate-400">Break this task down - add subtasks below.</div>}
                              {subs.map((sb, j) => (
                                <div key={j} className="flex items-start gap-2 group bg-white rounded-lg px-2 py-1.5 border border-slate-100">
                                  <input type="checkbox" checked={!!sb.done} onChange={() => toggleSub(i, j)} className="mt-0.5" />
                                  <span className={`flex-1 text-sm ${sb.done ? 'line-through text-slate-400' : 'text-slate-700'}`}>{sb.text}{sb.done && sb.done_by ? <span className="ml-1.5 text-[10px] text-emerald-600">{'\\u2713'} {String(sb.done_by).split(' ')[0]}</span> : null}</span>
                                  <button onClick={() => removeSub(i, j)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 text-xs">{'\\u2715'}</button>
                                </div>
                              ))}
                            </div>
                            <div className="flex gap-2 mt-2">
                              <input type="text" value={newSub} onChange={(e) => setNewSub(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSub(i); } }}
                                placeholder="Add a subtask and press Enter"
                                className="flex-1 text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-asap-blue bg-white" />
                              <button onClick={() => addSub(i)} className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 rounded-lg text-sm font-medium">Add</button>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>);"""
s = s.replace(a2, new2, 1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
print("tasks: expandable with subtasks + instructions + test links")
