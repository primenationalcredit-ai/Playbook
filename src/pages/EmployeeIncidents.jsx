import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Search, Plus, X, AlertTriangle, Award, FileText, CheckCircle2, Clock } from 'lucide-react';

const INCIDENT_TYPES = ['Verbal Warning', 'Written Warning', 'Final Warning', 'Commendation', 'Other'];

function typeStyle(type) {
  if (type === 'Commendation') return { pill: 'bg-emerald-100 text-emerald-700', icon: Award };
  if (type === 'Final Warning') return { pill: 'bg-red-100 text-red-700', icon: AlertTriangle };
  if (type === 'Written Warning') return { pill: 'bg-amber-100 text-amber-700', icon: FileText };
  if (type === 'Verbal Warning') return { pill: 'bg-orange-100 text-orange-700', icon: FileText };
  return { pill: 'bg-slate-100 text-slate-600', icon: FileText };
}

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysAgo(d) {
  if (!d) return null;
  const dt = new Date(d + 'T00:00:00');
  return Math.floor((Date.now() - dt.getTime()) / 86400000);
}

export default function EmployeeIncidents() {
  const { currentUser, users, supabaseFetch, supabasePost, supabasePatch, supabaseDelete } = useApp();
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('all'); // 'all' | 'byEmployee'
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [needsFollowUpOnly, setNeedsFollowUpOnly] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [expandedEmployee, setExpandedEmployee] = useState(null);

  const [formEmployeeId, setFormEmployeeId] = useState('');
  const [formType, setFormType] = useState(INCIDENT_TYPES[0]);
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formDescription, setFormDescription] = useState('');
  const [formFollowUpDate, setFormFollowUpDate] = useState('');
  const [saving, setSaving] = useState(false);

  const activeUsers = useMemo(
    () => (users || []).filter(u => u.department !== 'inactive').sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [users]
  );

  const load = async () => {
    setLoading(true);
    try {
      const data = await supabaseFetch('employee_incidents', 'select=*&order=incident_date.desc');
      setIncidents(Array.isArray(data) ? data : []);
    } catch (e) {
      setIncidents([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setFormEmployeeId('');
    setFormType(INCIDENT_TYPES[0]);
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormDescription('');
    setFormFollowUpDate('');
  };

  const handleSave = async () => {
    if (!formEmployeeId || !formType || !formDate) return;
    const employee = activeUsers.find(u => u.id === formEmployeeId);
    if (!employee) return;
    setSaving(true);
    try {
      await supabasePost('employee_incidents', {
        employee_user_id: employee.id,
        employee_name: employee.name,
        incident_type: formType,
        incident_date: formDate,
        description: formDescription || null,
        reported_by_user_id: currentUser?.id || null,
        reported_by_name: currentUser?.name || null,
        follow_up_date: formFollowUpDate || null,
        follow_up_completed: false,
      });
      resetForm();
      setShowForm(false);
      await load();
    } catch (e) {
      // fail visibly but don't lose the form contents
    }
    setSaving(false);
  };

  const toggleFollowUp = async (incident) => {
    try {
      await supabasePatch('employee_incidents', incident.id, { follow_up_completed: !incident.follow_up_completed });
      await load();
    } catch (e) {}
  };

  const handleDelete = async (incident) => {
    if (!window.confirm(`Delete this ${incident.incident_type} record for ${incident.employee_name}?`)) return;
    try {
      await supabaseDelete('employee_incidents', `id=eq.${incident.id}`);
      await load();
    } catch (e) {}
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return incidents.filter(i => {
      if (typeFilter && i.incident_type !== typeFilter) return false;
      if (needsFollowUpOnly) {
        if (!i.follow_up_date || i.follow_up_completed) return false;
        const da = daysAgo(i.follow_up_date);
        if (da === null || da < 0) return false;
      }
      if (!needle) return true;
      return (i.employee_name || '').toLowerCase().includes(needle) || (i.description || '').toLowerCase().includes(needle);
    });
  }, [incidents, q, typeFilter, needsFollowUpOnly]);

  const followUpDueCount = useMemo(
    () => incidents.filter(i => i.follow_up_date && !i.follow_up_completed && (daysAgo(i.follow_up_date) ?? -1) >= 0).length,
    [incidents]
  );

  const byEmployee = useMemo(() => {
    const map = {};
    incidents.forEach(i => {
      const key = i.employee_name || 'Unknown';
      if (!map[key]) map[key] = { name: key, items: [], counts: {} };
      map[key].items.push(i);
      map[key].counts[i.incident_type] = (map[key].counts[i.incident_type] || 0) + 1;
    });
    const arr = Object.values(map).map(e => {
      const last90 = e.items.filter(i => (daysAgo(i.incident_date) ?? 9999) <= 90).length;
      return { ...e, total: e.items.length, last90 };
    });
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      return arr.filter(e => e.name.toLowerCase().includes(needle));
    }
    return arr.sort((a, b) => b.total - a.total);
  }, [incidents, q]);

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-800 mb-2">Employee Incident Reports</h1>
          <p className="text-slate-500">Verbal warnings, write-ups, commendations, and other conduct or performance documentation.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-asap-blue text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90"
        >
          <Plus size={16} /> Log Incident
        </button>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setView('all')}
          className={`px-3 py-1.5 text-sm font-semibold rounded-lg ${view === 'all' ? 'bg-asap-blue text-white' : 'bg-white border border-slate-200 text-slate-600'}`}
        >
          All Incidents
        </button>
        <button
          onClick={() => setView('byEmployee')}
          className={`px-3 py-1.5 text-sm font-semibold rounded-lg ${view === 'byEmployee' ? 'bg-asap-blue text-white' : 'bg-white border border-slate-200 text-slate-600'}`}
        >
          By Employee
        </button>
        {followUpDueCount > 0 && (
          <span className="ml-2 inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
            <Clock size={12} /> {followUpDueCount} follow-up{followUpDueCount === 1 ? '' : 's'} due
          </span>
        )}
      </div>

      <div className="bg-white rounded-xl border shadow-sm p-4 mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search employee or description..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-asap-blue"
          />
        </div>
        {view === 'all' && (
          <>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-asap-blue"
            >
              <option value="">All Types</option>
              {INCIDENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={needsFollowUpOnly} onChange={(e) => setNeedsFollowUpOnly(e.target.checked)} />
              Needs follow-up
            </label>
          </>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800">Log Incident</h2>
              <button onClick={() => { setShowForm(false); resetForm(); }} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Employee</label>
                <select
                  value={formEmployeeId}
                  onChange={(e) => setFormEmployeeId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-asap-blue"
                >
                  <option value="">Select employee...</option>
                  {activeUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Type</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-asap-blue"
                >
                  {INCIDENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Date</label>
                <input
                  type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-asap-blue"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Description</label>
                <textarea
                  value={formDescription} onChange={(e) => setFormDescription(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-asap-blue"
                  placeholder="What happened..."
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Follow-up date (optional)</label>
                <input
                  type="date" value={formFollowUpDate} onChange={(e) => setFormFollowUpDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-asap-blue"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-5">
              <button onClick={() => { setShowForm(false); resetForm(); }} className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formEmployeeId}
                className="px-4 py-2 text-sm font-semibold bg-asap-blue text-white rounded-lg disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Incident'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl border shadow-sm p-8 text-center text-slate-400 text-sm">Loading...</div>
      ) : view === 'all' ? (
        filtered.length === 0 ? (
          <div className="bg-white rounded-xl border shadow-sm p-8 text-center text-slate-400 text-sm">
            {incidents.length === 0 ? 'No incidents logged yet.' : 'Nothing matches these filters.'}
          </div>
        ) : (
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Follow-up</th>
                  <th className="px-4 py-3">Reported By</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((i) => {
                  const style = typeStyle(i.incident_type);
                  const Icon = style.icon;
                  const overdue = i.follow_up_date && !i.follow_up_completed && (daysAgo(i.follow_up_date) ?? -1) >= 0;
                  return (
                    <tr key={i.id} className="hover:bg-slate-50 align-top">
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{fmtDate(i.incident_date)}</td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{i.employee_name}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${style.pill}`}>
                          <Icon size={12} /> {i.incident_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-xs">{i.description || '—'}</td>
                      <td className="px-4 py-3">
                        {i.follow_up_date ? (
                          <button onClick={() => toggleFollowUp(i)} className="inline-flex items-center gap-1 text-xs">
                            {i.follow_up_completed ? (
                              <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 size={14} /> Done</span>
                            ) : (
                              <span className={`inline-flex items-center gap-1 ${overdue ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
                                <Clock size={14} /> {fmtDate(i.follow_up_date)}
                              </span>
                            )}
                          </button>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{i.reported_by_name || '—'}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleDelete(i)} className="text-slate-300 hover:text-red-500">
                          <X size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : (
        byEmployee.length === 0 ? (
          <div className="bg-white rounded-xl border shadow-sm p-8 text-center text-slate-400 text-sm">No incidents logged yet.</div>
        ) : (
          <div className="space-y-3">
            {byEmployee.map((e) => {
              const isOpen = expandedEmployee === e.name;
              return (
                <div key={e.name} className="bg-white rounded-xl border shadow-sm overflow-hidden">
                  <button
                    onClick={() => setExpandedEmployee(isOpen ? null : e.name)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-slate-700">{e.name}</span>
                      <span className="text-xs text-slate-400">{e.total} total{e.last90 > 0 ? ` · ${e.last90} in last 90 days` : ''}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {Object.entries(e.counts).map(([type, count]) => {
                        const style = typeStyle(type);
                        return (
                          <span key={type} className={`px-2 py-0.5 rounded-full text-xs font-semibold ${style.pill}`}>
                            {count} {type}
                          </span>
                        );
                      })}
                    </div>
                  </button>
                  {isOpen && (
                    <div className="border-t border-slate-100 divide-y divide-slate-100">
                      {e.items.sort((a, b) => (b.incident_date || '').localeCompare(a.incident_date || '')).map((i) => {
                        const style = typeStyle(i.incident_type);
                        const Icon = style.icon;
                        return (
                          <div key={i.id} className="px-4 py-3 flex items-start gap-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${style.pill}`}>
                              <Icon size={12} /> {i.incident_type}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs text-slate-400">{fmtDate(i.incident_date)} · reported by {i.reported_by_name || 'unknown'}</div>
                              <div className="text-sm text-slate-600">{i.description || '—'}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
