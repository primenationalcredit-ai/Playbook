import sys
f = 'src/pages/LeadershipProjects.jsx'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
a1 = """    revisit_date: card?.revisit_date || '',
  });"""
if s.count(a1) != 1: print(f"ABORTED: formData anchor x{s.count(a1)}"); sys.exit(1)
s = s.replace(a1, """    revisit_date: card?.revisit_date || '',
    steps: Array.isArray(card?.steps) ? card.steps : [],
  });
  const [newStep, setNewStep] = useState('');
  const toggleStep = (i) => setFormData(prev => ({ ...prev, steps: prev.steps.map((st, j) => j === i ? { ...st, done: !st.done, done_by: !st.done ? (currentUser?.name || '') : null, done_at: !st.done ? new Date().toISOString() : null } : st) }));
  const addStep = () => { const t = newStep.trim(); if (!t) return; setFormData(prev => ({ ...prev, steps: [...prev.steps, { text: t, done: false }] })); setNewStep(''); };
  const removeStep = (i) => setFormData(prev => ({ ...prev, steps: prev.steps.filter((_, j) => j !== i) }));""", 1)
a2 = """          {/* Objective */}"""
if s.count(a2) != 1: print(f"ABORTED: objective anchor x{s.count(a2)}"); sys.exit(1)
s = s.replace(a2, """          {/* Steps checklist (Joe 8/11: project steps live in the card - leaders tick them off as they test) */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Steps ({formData.steps.filter(st => st.done).length}/{formData.steps.length} done)</label>
            <div className="space-y-1 max-h-56 overflow-y-auto border border-slate-200 rounded-lg p-2">
              {formData.steps.length === 0 && <div className="text-xs text-slate-400 p-1">No steps yet - add the checklist below.</div>}
              {formData.steps.map((st, i) => (
                <div key={i} className="flex items-start gap-2 group">
                  <input type="checkbox" checked={!!st.done} onChange={() => toggleStep(i)} className="mt-1" />
                  <div className={`flex-1 text-sm ${st.done ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                    {st.text}
                    {st.done && st.done_by && <span className="ml-2 text-[10px] text-emerald-600 no-underline">{'\\u2713'} {st.done_by}</span>}
                  </div>
                  <button type="button" onClick={() => removeStep(i)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 text-xs">{'\\u2715'}</button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <input type="text" value={newStep} onChange={(e) => setNewStep(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addStep(); } }}
                placeholder="Add a step and press Enter"
                className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-asap-blue" />
              <button type="button" onClick={addStep} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium">Add</button>
            </div>
          </div>

          {/* Objective */}""", 1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
print("LeadershipProjects: steps checklist in")
