import React, { useState, useEffect } from 'react';
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
