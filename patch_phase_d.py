import sys, os
G = """import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { GraduationCap, Lock, AlertCircle } from 'lucide-react';

// PHASE D of the AI Project Manager (Joe 8/13): overdue required training locks
// the Playbook for that employee until it is done. Reuses the training system
// that ALREADY exists (training_assignments + training_courses, auto-assigned on
// publish, completed_at stamped by TrainingCourse.jsx). The gate is a READ only.
// SAFETY, on purpose: (1) leadership/admin are NEVER locked; (2) it fails OPEN -
// supabaseFetch returns [] on any error, so an outage unlocks rather than locking
// out the team; (3) only PUBLISHED courses with a genuinely past due date count.
export function useTrainingLock(currentUser) {
  const { supabaseFetch } = useApp();
  const [locked, setLocked] = useState(false);
  const [overdue, setOverdue] = useState([]);
  const isExempt = currentUser?.department === 'leadership' || currentUser?.role === 'admin';
  useEffect(() => {
    if (!currentUser || isExempt) { setLocked(false); setOverdue([]); return; }
    let dead = false;
    (async () => {
      const rows = await supabaseFetch('training_assignments',
        `select=id,due_date,completed_at,training_courses(id,title,is_published)&user_id=eq.${currentUser.id}&completed_at=is.null`);
      const now = Date.now();
      const late = (rows || []).filter(r => r.training_courses && r.training_courses.is_published
        && r.due_date && new Date(r.due_date).getTime() < now);
      if (dead) return;
      setOverdue(late.map(r => ({ id: r.training_courses.id, title: r.training_courses.title, due: r.due_date })));
      setLocked(late.length > 0);
    })();
    return () => { dead = true; };
  }, [currentUser?.id, isExempt]);
  return { locked, overdue };
}

export function TrainingLockScreen({ overdue, onGo }) {
  const fmt = d => { try { return new Date(d).toLocaleDateString(); } catch (e) { return ''; } };
  return (
    <div className="min-h-full flex items-start justify-center p-6 bg-slate-50">
      <div className="w-full max-w-xl mt-12 bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
        <div className="px-6 py-5 bg-gradient-to-r from-amber-500 to-orange-600 text-white flex items-center gap-3">
          <Lock className="w-6 h-6 shrink-0" />
          <div>
            <div className="font-bold text-lg">Training required before you continue</div>
            <div className="text-white/90 text-sm">The rest of the Playbook is paused until this is done.</div>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-600">You have required training past its due date. Finish it and everything unlocks automatically.</p>
          <div className="space-y-2">
            {overdue.map(c => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-800 truncate">{c.title}</div>
                  <div className="text-xs text-amber-700">Was due {fmt(c.due)}</div>
                </div>
              </div>
            ))}
          </div>
          <button onClick={onGo} className="w-full px-5 py-3 rounded-xl bg-asap-blue text-white font-semibold text-sm hover:bg-asap-blue-dark flex items-center justify-center gap-2">
            <GraduationCap className="w-4 h-4" /> Go to my training
          </button>
          <p className="text-xs text-slate-400 text-center">If you believe this is a mistake, message leadership - they can extend your due date.</p>
        </div>
      </div>
    </div>
  );
}
"""
os.makedirs('src/components', exist_ok=True)
open('src/components/TrainingLockGate.jsx','w',encoding='utf-8',newline='').write(G)
print("1/3 TrainingLockGate.jsx")

f='src/components/Layout.jsx'; s=open(f,encoding='utf-8',errors='surrogateescape').read()
if 'useTrainingLock' in s: print("SKIP 2/3")
else:
    E=[("import { Outlet, NavLink, useNavigate } from 'react-router-dom';","import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';"),
       ("import CoverageAlerts from './CoverageAlerts';","import CoverageAlerts from './CoverageAlerts';\nimport { useTrainingLock, TrainingLockScreen } from './TrainingLockGate';"),
       ("  const navigate = useNavigate();","  const navigate = useNavigate();\n  const location = useLocation();\n  // PHASE D (Joe 8/13): overdue training locks every page except /training.\n  // Leadership exempt; fails open. See TrainingLockGate.jsx.\n  const { locked: trainingLocked, overdue: overdueTraining } = useTrainingLock(currentUser);\n  const onTrainingPage = (location.pathname || '').startsWith('/training');"),
       ("        <Outlet />","        {trainingLocked && !onTrainingPage\n          ? <TrainingLockScreen overdue={overdueTraining} onGo={() => navigate('/training')} />\n          : <Outlet />}")]
    for a,b in E:
        if s.count(a)!=1: print("ABORT 2/3 x"+str(s.count(a))+": "+a[:50]); sys.exit(1)
        s=s.replace(a,b,1)
    open(f,'w',encoding='utf-8',errors='surrogateescape',newline='').write(s); print("2/3 Layout.jsx")

f='src/pages/AdminTraining.jsx'; s=open(f,encoding='utf-8',errors='surrogateescape').read()
if 'openCompliance' in s: print("SKIP 3/3")
else:
    a="CheckCircle, XCircle, Eye, Rocket, BookOpen, Sparkles,"
    if s.count(a)!=1: print("ABORT 3/3 icons"); sys.exit(1)
    s=s.replace(a,a+"\n  ShieldCheck,",1)
    a="  const [courseStats, setCourseStats] = useState({});"
    if s.count(a)!=1: print("ABORT 3/3 state"); sys.exit(1)
    s=s.replace(a,a+"""
  // PHASE D (Joe 8/13): per-course compliance + the leadership override the lock
  // gate requires. Writes only existing columns, so no migration.
  const [compCourse, setCompCourse] = useState(null);
  const [compRows, setCompRows] = useState([]);
  const [compBusy, setCompBusy] = useState(false);
  const openCompliance = async (course) => {
    setCompCourse(course); setCompBusy(true); setCompRows([]);
    const rows = await supabaseFetch('training_assignments', `select=*&course_id=eq.${course.id}`);
    const byId = {}; (users || []).forEach(u => { byId[u.id] = u; });
    const now = Date.now();
    setCompRows((rows || []).map(r => {
      const u = byId[r.user_id] || {};
      return { id: r.id, name: u.name || 'Unknown user', dept: u.department || '',
        due: r.due_date, done: r.completed_at,
        late: !r.completed_at && r.due_date && new Date(r.due_date).getTime() < now,
        exempt: u.department === 'leadership' || u.role === 'admin' };
    }).sort((x, y) => (y.late ? 1 : 0) - (x.late ? 1 : 0) || String(x.name).localeCompare(String(y.name))));
    setCompBusy(false);
  };
  const extendDue = async (row, days) => {
    const next = new Date(Math.max(row.due ? new Date(row.due).getTime() : Date.now(), Date.now()));
    next.setDate(next.getDate() + days);
    await supabasePatch('training_assignments', row.id, { due_date: next.toISOString() });
    setCompRows(p => p.map(r => r.id === row.id ? { ...r, due: next.toISOString(), late: false } : r));
  };
  const clearAssignment = async (row) => {
    const at = new Date().toISOString();
    await supabasePatch('training_assignments', row.id, { completed_at: at });
    setCompRows(p => p.map(r => r.id === row.id ? { ...r, done: at, late: false } : r));
  };""",1)
    ob='''                  <button
                    onClick={() => navigate(`/admin/training/${course.id}`)}
                    className="p-2 text-slate-400 hover:text-asap-blue hover:bg-slate-100 rounded-lg transition-colors"
                    title="Edit Content"'''
    if s.count(ob)!=1: print("ABORT 3/3 btn x"+str(s.count(ob))); sys.exit(1)
    s=s.replace(ob,'''                  <button
                    onClick={() => openCompliance(course)}
                    className="p-2 text-slate-400 hover:text-amber-600 hover:bg-slate-100 rounded-lg transition-colors"
                    title="Who is overdue / override"
                  >
                    <ShieldCheck className="w-4 h-4" />
                  </button>
'''+ob,1)
    M='''      {/* PHASE D compliance + override */}
      {compCourse && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col" style={{ maxHeight: '85vh' }}>
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-800">Training compliance</div>
                <div className="text-xs text-slate-500">{compCourse.title}</div>
              </div>
              <button onClick={() => setCompCourse(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {compBusy && <div className="text-sm text-slate-400 p-4">Loading...</div>}
              {!compBusy && compRows.length === 0 && <div className="text-sm text-slate-400 p-4">Nobody is assigned to this course yet.</div>}
              {!compBusy && compRows.length > 0 && (
                <table className="w-full text-sm">
                  <thead><tr className="text-xs text-slate-400 uppercase text-left"><th className="py-2">Employee</th><th>Due</th><th>Status</th><th className="text-right">Override</th></tr></thead>
                  <tbody>
                    {compRows.map(r => (
                      <tr key={r.id} className="border-t border-slate-100">
                        <td className="py-2">
                          <div className="font-medium text-slate-700">{r.name}</div>
                          <div className="text-xs text-slate-400">{r.dept}{r.exempt ? ' - never locked' : ''}</div>
                        </td>
                        <td className="text-slate-600 text-xs">{r.due ? new Date(r.due).toLocaleDateString() : 'no due date'}</td>
                        <td>{r.done
                          ? <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Complete</span>
                          : r.late
                            ? <span className="text-xs px-2 py-0.5 rounded-full bg-rose-50 text-rose-700">{r.exempt ? 'Overdue' : 'Overdue - locked out'}</span>
                            : <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">On track</span>}</td>
                        <td className="text-right whitespace-nowrap">
                          {!r.done && (<>
                            <button onClick={() => extendDue(r, 7)} className="px-2 py-1 text-xs rounded-lg border border-slate-200 hover:bg-slate-50 mr-1">+7 days</button>
                            <button onClick={() => clearAssignment(r)} className="px-2 py-1 text-xs rounded-lg border border-slate-200 text-emerald-700 hover:bg-emerald-50">Clear</button>
                          </>)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="px-5 py-3 border-t border-slate-200 text-xs text-slate-500">Extending pushes the deadline and unlocks them until then. Clearing marks it complete for that person - only when they have genuinely done it or are exempt.</div>
          </div>
        </div>
      )}
'''
    T="    </div>\n  );\n}\n\nexport default AdminTraining;"
    if s.count(T)!=1: print("ABORT 3/3 tail x"+str(s.count(T))); sys.exit(1)
    s=s.replace(T,M+T,1)
    open(f,'w',encoding='utf-8',errors='surrogateescape',newline='').write(s); print("3/3 AdminTraining.jsx")
print("PHASE D PATCHED")
