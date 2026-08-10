import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import { BookOpen, Loader2, Users } from 'lucide-react';

// MyBook - CRM migration (Joe 8/10): each AM's client book front and center.
// AMs land on their own book (matched by account_manager_name); leadership
// gets the roster with book sizes and can open anyone's book.
function MyBook() {
  const { currentUser } = useApp();
  const [roster, setRoster] = useState([]);
  const [amName, setAmName] = useState(null);
  const [clients, setClients] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [options, setOptions] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingBook, setLoadingBook] = useState(false);
  const isLeadership = currentUser && ['leadership', 'admin'].includes((currentUser.department || '').toLowerCase());

  useEffect(() => {
    const init = async () => {
      const { data: ros } = await supabase.rpc('crm_am_roster');
      setRoster(ros || []);
      const { data: opts } = await supabase.from('crm_field_options').select('field_key,option_id,option_label').eq('field_key', 'current_status');
      const m = {}; for (const o of (opts || [])) m[o.option_id] = o.option_label;
      setOptions(m);
      if (currentUser && currentUser.name) {
        const mine = (ros || []).find(r => r.account_manager_name && r.account_manager_name.toLowerCase() === currentUser.name.toLowerCase());
        if (mine) setAmName(mine.account_manager_name);
        else if (!isLeadership && ros && ros.length) setAmName(null);
      }
      setLoading(false);
    };
    init();
  }, [currentUser]);

  useEffect(() => {
    const loadBook = async () => {
      if (!amName) { setClients([]); return; }
      setLoadingBook(true);
      let q = supabase.from('crm_clients')
        .select('pipedrive_person_id,name,email,phone,current_status,pd_update_time')
        .eq('deleted', false).eq('account_manager_name', amName)
        .order('pd_update_time', { ascending: false }).limit(300);
      if (statusFilter) q = q.eq('current_status', parseInt(statusFilter));
      const { data } = await q;
      setClients(data || []);
      setLoadingBook(false);
    };
    loadBook();
  }, [amName, statusFilter]);

  const myBookSize = amName && (roster.find(r => r.account_manager_name === amName) || {}).book_size;

  if (loading) return <div className="p-6 flex items-center gap-2 text-gray-500"><Loader2 className="w-5 h-5 animate-spin" /> Loading...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 mb-1"><BookOpen className="w-6 h-6 text-blue-600" /><h1 className="text-2xl font-bold">{isLeadership ? 'AM Books' : 'My Book'}</h1></div>
      <p className="text-sm text-gray-500 mb-4">{amName ? `${amName} - ${Number(myBookSize || 0).toLocaleString()} clients` : 'Client books by account manager.'}</p>
      {isLeadership && (
        <div className="flex gap-2 flex-wrap mb-4">
          {roster.slice(0, 20).map(r => (
            <button key={r.account_manager_name} onClick={() => setAmName(r.account_manager_name)}
              className={`px-3 py-1.5 rounded-lg text-sm border ${r.account_manager_name === amName ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-gray-50'}`}>
              {r.account_manager_name} <span className="opacity-70">({Number(r.book_size).toLocaleString()})</span>
            </button>
          ))}
        </div>
      )}
      {!amName && !isLeadership && <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800 text-sm">No client book found under your name ({currentUser && currentUser.name}). If your Pipedrive AM name differs, tell Joe - a one-line alias fixes it.</div>}
      {amName && (
        <>
          <div className="mb-3">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border rounded-lg p-2 text-sm bg-white">
              <option value="">All statuses</option>
              {Object.entries(options).sort((a, b) => a[1].localeCompare(b[1])).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </div>
          {loadingBook && <div className="flex items-center gap-2 text-gray-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading book...</div>}
          {!loadingBook && (
            <div className="bg-white rounded-lg shadow divide-y">
              {clients.map(c => (
                <Link key={c.pipedrive_person_id} to={`/clients?person=${c.pipedrive_person_id}`} className="block p-3 hover:bg-blue-50">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{c.name}</div>
                      <div className="text-xs text-gray-500 truncate">{c.email || 'no email'} {c.phone ? `- ${c.phone}` : ''}</div>
                    </div>
                    {options[c.current_status] && <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded whitespace-nowrap">{options[c.current_status]}</span>}
                  </div>
                </Link>
              ))}
              {clients.length === 0 && <div className="p-4 text-sm text-gray-400">No clients match.</div>}
              {clients.length === 300 && <div className="p-2 text-xs text-gray-400 text-center">most recently updated 300 shown - use the status filter or Clients search to narrow</div>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
export default MyBook;
