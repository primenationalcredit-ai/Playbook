import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import { CheckSquare, Calendar, Loader2, User } from 'lucide-react';

// MyDay - CRM migration (Joe 8/10): every open task assigned to the logged-in
// user across all clients, from our own crm_activities mirror. Grouped by
// urgency; each row deep-links into the Client File; Mark done writes back
// (Pipedrive first) via crm-activity-write.
const todayStr = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
const fmtDate = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'No date';

function MyDay() {
  const { currentUser } = useApp();
  const [rows, setRows] = useState([]);
  const [names, setNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [completingId, setCompletingId] = useState(null);

  useEffect(() => {
    const load = async () => {
      if (!currentUser || !currentUser.name) { setLoading(false); return; }
      const { data } = await supabase.from('crm_activities')
        .select('pipedrive_activity_id,subject,activity_type,due_date,due_time,pipedrive_deal_id,pipedrive_person_id,note')
        .eq('done', false).ilike('owner_name', currentUser.name)
        .order('due_date', { ascending: true, nullsFirst: false }).limit(300);
      const list = data || [];
      setRows(list);
      const pids = [...new Set(list.map(r => r.pipedrive_person_id).filter(Boolean))];
      if (pids.length) {
        const nm = {};
        for (let i = 0; i < pids.length; i += 100) {
          const { data: cs } = await supabase.from('crm_clients').select('pipedrive_person_id,name').in('pipedrive_person_id', pids.slice(i, i + 100));
          for (const c of (cs || [])) nm[c.pipedrive_person_id] = c.name;
        }
        setNames(nm);
      }
      setLoading(false);
    };
    load();
  }, [currentUser]);

  const markDone = async (r) => {
    if (completingId) return;
    setCompletingId(r.pipedrive_activity_id);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess && sess.session && sess.session.access_token;
      const res = await fetch('/.netlify/functions/crm-activity-write', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'complete', activity_id: r.pipedrive_activity_id })
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setRows(rows.filter(x => x.pipedrive_activity_id !== r.pipedrive_activity_id));
    } catch (e) { alert('Mark done failed: ' + e.message); }
    setCompletingId(null);
  };

  const t = todayStr();
  const weekEnd = new Date(Date.now() + 6 * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
  const groups = [
    ['Overdue', rows.filter(r => r.due_date && r.due_date < t), 'text-red-600'],
    ['Today', rows.filter(r => r.due_date === t), 'text-blue-600'],
    ['This Week', rows.filter(r => r.due_date && r.due_date > t && r.due_date <= weekEnd), 'text-gray-800'],
    ['Later / No date', rows.filter(r => !r.due_date || r.due_date > weekEnd), 'text-gray-500']
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-1"><CheckSquare className="w-6 h-6 text-blue-600" /><h1 className="text-2xl font-bold">My Day</h1></div>
      <p className="text-sm text-gray-500 mb-5">Your open tasks across every client. Completing one updates Pipedrive too.</p>
      {loading && <div className="flex items-center gap-2 text-gray-500"><Loader2 className="w-5 h-5 animate-spin" /> Loading your tasks...</div>}
      {!loading && rows.length === 0 && <div className="bg-green-50 border border-green-200 rounded-lg p-5 text-green-800">Nothing open - clean slate. 🎉</div>}
      {!loading && groups.map(([label, items, color]) => items.length > 0 && (
        <div key={label} className="mb-6">
          <h2 className={`text-sm font-bold uppercase tracking-wide mb-2 ${color}`}>{label} ({items.length})</h2>
          <div className="bg-white rounded-lg shadow divide-y">
            {items.map(r => (
              <div key={r.pipedrive_activity_id} className="p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{r.subject || '(no subject)'}</div>
                  <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                    <Calendar className="w-3 h-3" />{fmtDate(r.due_date)}{r.due_time ? ` ${r.due_time}` : ''}
                    {r.pipedrive_person_id && (
                      <Link to={`/clients?person=${r.pipedrive_person_id}${r.pipedrive_deal_id ? `&deal=${r.pipedrive_deal_id}` : ''}`}
                        className="inline-flex items-center gap-1 text-blue-600 hover:underline"><User className="w-3 h-3" />{names[r.pipedrive_person_id] || `#${r.pipedrive_person_id}`}</Link>
                    )}
                    <span className="text-gray-400">{r.activity_type}</span>
                  </div>
                </div>
                <button onClick={() => markDone(r)} disabled={completingId === r.pipedrive_activity_id}
                  className="text-xs text-green-700 font-medium hover:underline whitespace-nowrap disabled:opacity-50">
                  {completingId === r.pipedrive_activity_id ? 'Saving...' : 'Mark done'}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
export default MyDay;
