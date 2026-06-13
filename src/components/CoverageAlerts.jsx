import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import {
  AlertTriangle,
  CheckCircle,
  Shield,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

function CoverageAlerts() {
  const { currentUser, users, taskTemplates, supabaseFetch, getTasksForUser } = useApp();
  const [usersOut, setUsersOut] = useState([]);
  const [coverageReport, setCoverageReport] = useState({ covered: [], uncovered: [], noBackup: [] });
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(new Set());
  const [expanded, setExpanded] = useState(true);

  const isLeader = currentUser?.department === 'leadership' || currentUser?.role === 'admin';

  const detectOutUsers = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      let dailyOutIds = [];
      try { dailyOutIds = ((await supabaseFetch('daily_out', `date=eq.${today}`)) || []).map(e => e.user_id); } catch(e) {}
      let ptoUserIds = [];
      try { ptoUserIds = ((await supabaseFetch('time_off_requests', `status=eq.approved&start_date=lte.${today}&end_date=gte.${today}`)) || []).map(p => p.user_id); } catch(e) {}
      return [...new Set([...dailyOutIds, ...ptoUserIds])];
    } catch (err) {
      console.error('Error detecting out users:', err);
      return [];
    }
  }, [supabaseFetch]);

  const buildReport = useCallback((outUserIds) => {
    const covered = [];
    const uncovered = [];
    const noBackup = [];
    const outSet = new Set(outUserIds);
    const seen = new Set();

    outUserIds.forEach(outUserId => {
      const outUser = users.find(u => u.id === outUserId);
      if (!outUser) return;

      const userTasks = getTasksForUser(outUserId);
      userTasks.forEach(task => {
        if (seen.has(task.id + outUserId)) return;
        seen.add(task.id + outUserId);
        
        const template = taskTemplates.find(t => t.id === task.id);
        if (!template) return;

        const b1 = template.backup_user_1;
        const b2 = template.backup_user_2;
        const b1User = b1 ? users.find(u => u.id === b1) : null;
        const b2User = b2 ? users.find(u => u.id === b2) : null;

        const entry = {
          taskId: task.id,
          taskTitle: task.title || template.title,
          timeSlot: template.time_slot,
          outUser,
          b1User,
          b2User,
        };

        if (!b1 && !b2) {
          noBackup.push(entry);
        } else if (b1 && !outSet.has(b1)) {
          covered.push({ ...entry, coveredBy: b1User, level: 'B1' });
        } else if (b2 && !outSet.has(b2)) {
          covered.push({ ...entry, coveredBy: b2User, level: 'B2' });
        } else {
          uncovered.push(entry);
        }
      });
    });

    return { covered, uncovered, noBackup };
  }, [users, taskTemplates, getTasksForUser]);

  useEffect(() => {
    if (!isLeader) { setLoading(false); return; }

    const load = async () => {
      setLoading(true);
      const outIds = await detectOutUsers();
      setUsersOut(outIds);
      if (outIds.length > 0) {
        setCoverageReport(buildReport(outIds));
      }
      setLoading(false);
    };

    load();
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isLeader, detectOutUsers, buildReport]);

  if (!isLeader || loading) return null;

  const outUsers = usersOut.map(id => users.find(u => u.id === id)).filter(Boolean);
  const { covered, uncovered, noBackup } = coverageReport;
  const criticalCount = uncovered.length + noBackup.length;

  if (outUsers.length === 0) return null;

  return (
    <div className="mb-6">
      <div className={`rounded-2xl border overflow-hidden ${
        criticalCount > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
      }`}>
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between p-4"
        >
          <div className="flex items-center gap-3">
            {criticalCount > 0 ? (
              <div className="p-2 bg-red-100 rounded-xl">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
            ) : (
              <div className="p-2 bg-green-100 rounded-xl">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
            )}
            <div className="text-left">
              <h3 className={`font-semibold ${criticalCount > 0 ? 'text-red-800' : 'text-green-800'}`}>
                {outUsers.length} Team Member{outUsers.length !== 1 ? 's' : ''} Out Today
              </h3>
              <p className={`text-sm ${criticalCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {criticalCount > 0
                  ? `⚠️ ${criticalCount} task${criticalCount !== 1 ? 's' : ''} need manual assignment`
                  : `✅ All ${covered.length} task${covered.length !== 1 ? 's' : ''} covered by backups`
                }
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {criticalCount > 0 && (
              <span className="px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse">
                {criticalCount} ACTION NEEDED
              </span>
            )}
            {expanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
          </div>
        </button>

        {expanded && (
          <div className="border-t border-slate-200 p-4 space-y-4 bg-white/80">
            {/* Who's Out */}
            <div className="flex flex-wrap gap-2">
              {outUsers.map(u => (
                <span key={u.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-full text-sm">
                  <div className="w-5 h-5 rounded-full bg-red-400 text-white flex items-center justify-center text-[10px] font-bold">
                    {u.name?.charAt(0)}
                  </div>
                  {u.name}
                </span>
              ))}
            </div>

            {/* CRITICAL: Uncovered Tasks */}
            {uncovered.filter(t => !dismissed.has(t.taskId + '-unc')).length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <h4 className="font-semibold text-red-800 mb-2 flex items-center gap-2">
                  <AlertTriangle size={16} />
                  Uncovered — Assignee + All Backups Out ({uncovered.filter(t => !dismissed.has(t.taskId + '-unc')).length})
                </h4>
                <p className="text-xs text-red-600 mb-3">
                  Please manually assign these tasks to available team members.
                </p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {uncovered.filter(t => !dismissed.has(t.taskId + '-unc')).map(t => (
                    <div key={t.taskId + t.outUser.id} className="flex items-center justify-between bg-white rounded-lg p-3 border border-red-100">
                      <div>
                        <p className="font-medium text-slate-800 text-sm">{t.taskTitle}</p>
                        <p className="text-xs text-slate-500">
                          {t.outUser.name} is out
                          {t.b1User ? ` • B1 ${t.b1User.name} also out` : ' • No B1'}
                          {t.b2User ? ` • B2 ${t.b2User.name} also out` : ' • No B2'}
                        </p>
                      </div>
                      <button
                        onClick={() => setDismissed(prev => new Set([...prev, t.taskId + '-unc']))}
                        className="text-xs px-3 py-1.5 bg-green-100 hover:bg-green-200 rounded-lg text-green-700 font-medium flex-shrink-0"
                      >
                        ✓ Handled
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* WARNING: No Backup Assigned */}
            {noBackup.filter(t => !dismissed.has(t.taskId + '-nb')).length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <h4 className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
                  <Shield size={16} />
                  No Backup Assigned ({noBackup.filter(t => !dismissed.has(t.taskId + '-nb')).length})
                </h4>
                <p className="text-xs text-amber-600 mb-3">
                  These tasks have no backup set. Go to Admin → Tasks and assign backups.
                </p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {noBackup.filter(t => !dismissed.has(t.taskId + '-nb')).map(t => (
                    <div key={t.taskId + t.outUser.id} className="flex items-center justify-between bg-white rounded-lg p-3 border border-amber-100">
                      <div>
                        <p className="font-medium text-slate-800 text-sm">{t.taskTitle}</p>
                        <p className="text-xs text-slate-500">{t.outUser.name} is out • No backup configured</p>
                      </div>
                      <button
                        onClick={() => setDismissed(prev => new Set([...prev, t.taskId + '-nb']))}
                        className="text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-600 flex-shrink-0"
                      >
                        Dismiss
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* OK: Covered Tasks */}
            {covered.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <h4 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
                  <CheckCircle size={16} />
                  Covered by Backups ({covered.length})
                </h4>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {covered.map(t => (
                    <div key={t.taskId + t.outUser.id} className="flex items-center gap-2 text-sm text-green-700 py-1">
                      <CheckCircle size={14} className="text-green-500 flex-shrink-0" />
                      <span className="truncate">{t.taskTitle}</span>
                      <span className="text-xs text-green-600 flex-shrink-0">→ {t.coveredBy?.name} ({t.level})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default CoverageAlerts;
