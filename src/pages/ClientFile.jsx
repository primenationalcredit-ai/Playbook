import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Search, User, FileText, Calendar, DollarSign, MessageSquare, CheckSquare, MapPin, Phone, Mail, Loader2 } from 'lucide-react';

// ClientFile - Phase 2 screen #1 of the CRM migration (Joe 8/10).
// Reads ONLY from our own crm_* mirror + consultant_payments. Read-only v1:
// edits still happen in Pipedrive until write-back ships. Statuses decode via
// crm_field_options (no magic numbers).
const stripHtml = (h) => (h || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-';
const fmtDT = (d) => d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '-';

function ClientFile() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [client, setClient] = useState(null);
  const [deals, setDeals] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [payments, setPayments] = useState([]);
  const [notes, setNotes] = useState([]);
  const [activities, setActivities] = useState([]);
  const [options, setOptions] = useState({});
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('notes');
  const [stageEditId, setStageEditId] = useState(null);
  const [stageCatalog, setStageCatalog] = useState([]);
  const [stageDraft, setStageDraft] = useState('');
  const [savingStage, setSavingStage] = useState(false);
  const [taskDraft, setTaskDraft] = useState('');
  const [taskDue, setTaskDue] = useState('');
  const [postingTask, setPostingTask] = useState(false);
  const [completingId, setCompletingId] = useState(null);
  const [statusEdit, setStatusEdit] = useState(false);
  const [statusDraft, setStatusDraft] = useState({});
  const [savingStatus, setSavingStatus] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [postingNote, setPostingNote] = useState(false);
  const debounceRef = useRef(null);
  const { currentUser } = useApp();
  const isLeadership = currentUser && ['leadership', 'admin'].includes((currentUser.department || '').toLowerCase());
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeQuery, setMergeQuery] = useState('');
  const [mergeCands, setMergeCands] = useState([]);
  const [merging, setMerging] = useState(false);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const pid = parseInt(searchParams.get('person'));
    const did = parseInt(searchParams.get('deal')) || undefined;
    if (pid) openClient({ pipedrive_person_id: pid, name: '' }, did);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    supabase.from('crm_field_options').select('field_key,option_id,label').then(({ data }) => {
      const m = {};
      for (const o of (data || [])) { if (!m[o.field_key]) m[o.field_key] = {}; m[o.field_key][o.option_id] = o.label; }
      setOptions(m);
    });
  }, []);
  const opt = (key, id) => (id === null || id === undefined) ? null : ((options[key] && options[key][id]) || String(id));

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      // Deal-centric fuzzy search via the crm_deal_search RPC: matches deal title
      // OR the client's name/email/phone (typo-tolerant), ranked by closeness.
      const { data, error } = await supabase.rpc('crm_deal_search', { q });
      if (error) console.error('client search error:', error);
      setResults(data || []);
      setSearching(false);
    }, 300);
  }, [query]);

  const openClient = async (row, focusDealId) => {
    setLoading(true); setClient(row); setResults([]); setQuery(row.name || '');
    const pid = row.pipedrive_person_id;
    const { data: full } = await supabase.from('crm_clients').select('*').eq('pipedrive_person_id', pid).limit(1);
    if (full && full[0]) setClient(full[0]);
    const { data: ds } = await supabase.from('crm_deals').select('*').eq('pipedrive_person_id', pid).order('pd_add_time', { ascending: false });
    const dealList = (ds || []).sort((a, b) => (b.pipedrive_deal_id === focusDealId ? 1 : 0) - (a.pipedrive_deal_id === focusDealId ? 1 : 0));
    setDeals(dealList);
    const ids = dealList.map(d => d.pipedrive_deal_id).filter(Boolean);
    const idCsv = ids.join(',');
    if (ids.length) {
      const [{ data: rs }, { data: ps }] = await Promise.all([
        supabase.from('crm_rounds').select('*').in('pipedrive_deal_id', ids),
        supabase.from('consultant_payments').select('pipedrive_deal_id,payment_type,payment_date,amount,consultant_name').in('pipedrive_deal_id', ids).order('payment_date', { ascending: false })
      ]);
      setRounds(rs || []); setPayments(ps || []);
    } else { setRounds([]); setPayments([]); }
    const orFilter = ids.length ? `pipedrive_person_id.eq.${pid},pipedrive_deal_id.in.(${idCsv})` : `pipedrive_person_id.eq.${pid}`;
    const [{ data: ns }, { data: as }] = await Promise.all([
      supabase.from('crm_notes').select('pd_add_time,author,content,pinned').or(orFilter).order('pd_add_time', { ascending: false }).limit(30),
      supabase.from('crm_activities').select('pipedrive_activity_id,pd_add_time,subject,activity_type,done,due_date,owner_name,note').or(orFilter).order('pd_add_time', { ascending: false }).limit(40)
    ]);
    setNotes(ns || []); setActivities(as || []);
    setLoading(false);
  };

  const optList = (key) => Object.entries(options[key] || {}).map(([id, label]) => ({ id: parseInt(id), label })).sort((a, b) => (a.label || '').localeCompare(b.label || ''));

  const saveStatus = async () => {
    if (savingStatus || !client) return;
    const changes = {};
    for (const k of ['current_status', 'update_status', 'quick_buttons']) {
      if (statusDraft[k] !== undefined && statusDraft[k] !== '' && parseInt(statusDraft[k]) !== client[k]) changes[k] = parseInt(statusDraft[k]);
    }
    if (!Object.keys(changes).length) { setStatusEdit(false); return; }
    setSavingStatus(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess && sess.session && sess.session.access_token;
      const res = await fetch('/.netlify/functions/crm-person-update', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ person_id: client.pipedrive_person_id, ...changes })
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setClient({ ...client, ...changes });
      setStatusEdit(false); setStatusDraft({});
    } catch (e) { alert('Status update failed: ' + e.message); }
    setSavingStatus(false);
  };

    const searchMergeCands = async (q) => {
    setMergeQuery(q);
    if (q.trim().length < 2) { setMergeCands([]); return; }
    const { data } = await supabase.from('crm_clients')
      .select('pipedrive_person_id,name,email,phone')
      .eq('deleted', false).neq('pipedrive_person_id', client.pipedrive_person_id)
      .ilike('search_blob', `%${q.trim().toLowerCase()}%`).limit(8);
    setMergeCands(data || []);
  };

  const mergeDuplicate = async (dup) => {
    if (merging) return;
    if (!window.confirm(`Merge "${dup.name}" (#${dup.pipedrive_person_id}) INTO "${client.name}" (#${client.pipedrive_person_id})?\n\nThe duplicate is merged in Pipedrive itself - its deals, notes, and activities all move to this client. This cannot be undone.`)) return;
    setMerging(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess && sess.session && sess.session.access_token;
      const res = await fetch('/.netlify/functions/crm-person-merge', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ survivor_id: client.pipedrive_person_id, duplicate_id: dup.pipedrive_person_id })
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setMergeOpen(false); setMergeQuery(''); setMergeCands([]);
      openClient({ pipedrive_person_id: client.pipedrive_person_id, name: client.name });
    } catch (e) { alert('Merge failed: ' + e.message); }
    setMerging(false);
  };

    const openStageEdit = async (d) => {
    let cat = stageCatalog;
    if (!cat.length) {
      try {
        const res = await fetch('/.netlify/functions/crm-deal-update?action=stages');
        const j = await res.json();
        cat = j.pipelines || [];
        setStageCatalog(cat);
      } catch (e) { alert('Could not load stages: ' + e.message); return; }
    }
    setStageDraft(String(d.stage_id || ''));
    setStageEditId(d.pipedrive_deal_id);
  };

  const moveStage = async (d) => {
    const sid = parseInt(stageDraft);
    if (!sid || savingStage) return;
    if (sid === d.stage_id) { setStageEditId(null); return; }
    setSavingStage(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess && sess.session && sess.session.access_token;
      const res = await fetch('/.netlify/functions/crm-deal-update', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'move', deal_id: d.pipedrive_deal_id, stage_id: sid })
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setDeals(deals.map(x => x.pipedrive_deal_id === d.pipedrive_deal_id ? { ...x, stage_id: sid, stage_name: j.stage_name, pipeline_id: j.pipeline_id, pipeline_name: j.pipeline_name } : x));
      setStageEditId(null);
    } catch (e) { alert('Stage move failed: ' + e.message); }
    setSavingStage(false);
  };

    const authedPost = async (payload) => {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess && sess.session && sess.session.access_token;
    const res = await fetch('/.netlify/functions/crm-activity-write', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
    const j = await res.json();
    if (!res.ok || !j.ok) throw new Error(j.error || `HTTP ${res.status}`);
    return j;
  };

  const createTask = async () => {
    const subject = taskDraft.trim();
    if (!subject || postingTask || !client) return;
    setPostingTask(true);
    try {
      const j = await authedPost({ action: 'create', subject, due_date: taskDue || null, person_id: client.pipedrive_person_id, deal_id: (deals[0] && deals[0].pipedrive_deal_id) || null });
      setActivities([{ pipedrive_activity_id: j.activity_id, pd_add_time: new Date().toISOString(), subject, activity_type: 'task', done: false, due_date: taskDue || null, owner_name: j.author }, ...activities]);
      setTaskDraft(''); setTaskDue('');
    } catch (e) { alert('Task failed: ' + e.message); }
    setPostingTask(false);
  };

  const completeActivity = async (a) => {
    if (!a.pipedrive_activity_id || completingId) return;
    setCompletingId(a.pipedrive_activity_id);
    try {
      await authedPost({ action: 'complete', activity_id: a.pipedrive_activity_id });
      setActivities(activities.map(x => x.pipedrive_activity_id === a.pipedrive_activity_id ? { ...x, done: true } : x));
    } catch (e) { alert('Complete failed: ' + e.message); }
    setCompletingId(null);
  };

    const postNote = async () => {
    const content = noteDraft.trim();
    if (!content || postingNote || !client) return;
    setPostingNote(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess && sess.session && sess.session.access_token;
      const res = await fetch('/.netlify/functions/crm-note-write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ person_id: client.pipedrive_person_id, deal_id: (deals[0] && deals[0].pipedrive_deal_id) || null, content })
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setNotes([{ pd_add_time: new Date().toISOString(), author: j.author, content, pinned: false }, ...notes]);
      setNoteDraft('');
    } catch (e) { alert('Note failed: ' + e.message); }
    setPostingNote(false);
  };

    const Badge = ({ children, color }) => children ? (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${color || 'bg-blue-100 text-blue-800'}`}>{children}</span>
  ) : null;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-1"><User className="w-6 h-6 text-blue-600" /><h1 className="text-2xl font-bold">Clients</h1></div>
      <p className="text-sm text-gray-500 mb-4">Search the full client base - served from our own database. Read-only for now; edits still happen in Pipedrive.</p>
      {!client && (
      <div className="relative mb-6">
        <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search deals by client name, deal title, email, or phone..."
          className="w-full pl-9 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        {searching && <Loader2 className="w-4 h-4 absolute right-3 top-3 animate-spin text-gray-400" />}
        {results.length > 0 && (
          <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-80 overflow-y-auto">
            {results.map(r => (
              <button key={r.pipedrive_deal_id} onClick={() => openClient({ pipedrive_person_id: r.pipedrive_person_id, name: r.person_name }, r.pipedrive_deal_id)} className="w-full text-left px-4 py-2 hover:bg-blue-50 border-b last:border-b-0">
                <div className="font-medium">{r.title} <span className="text-xs text-gray-400">#{r.pipedrive_deal_id}</span></div>
                <div className="text-xs text-gray-500">{r.person_name || 'no person'} {r.email ? `- ${r.email}` : ''} {r.phone ? `- ${r.phone}` : ''}</div>
                <div className="text-xs mt-0.5 flex flex-wrap gap-1.5">
                  {opt('current_status', r.current_status) && <span className="bg-green-50 text-green-700 px-1.5 py-0.5 rounded">{opt('current_status', r.current_status)}</span>}
                  {r.stage_name && <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{r.stage_name}</span>}
                  {r.status && <span className={`px-1.5 py-0.5 rounded ${r.status === 'won' ? 'bg-emerald-50 text-emerald-700' : r.status === 'lost' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-700'}`}>{r.status}</span>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      )}
      {client && !loading && (
        <button onClick={() => { setClient(null); setQuery(''); setResults([]); }}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-blue-600 font-medium hover:underline">
          <Search className="w-4 h-4" /> New search
        </button>
      )}
      {loading && <div className="flex items-center gap-2 text-gray-500"><Loader2 className="w-5 h-5 animate-spin" /> Loading client file...</div>}
      {client && !loading && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">{client.name}</h2>
                <div className="text-sm text-gray-600 mt-1 space-y-0.5">
                  {client.email && <div className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />{client.email}</div>}
                  {client.phone && <div className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{client.phone}</div>}
                  {client.address && <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{client.address}</div>}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge color="bg-green-100 text-green-800">{opt('current_status', client.current_status)}</Badge>
                <Badge color="bg-purple-100 text-purple-800">{opt('update_status', client.update_status)}</Badge>
                <Badge color="bg-amber-100 text-amber-800">{opt('person1_reports', client.person1_reports)}</Badge>
              </div>
            </div>
            {!statusEdit && (
              <button onClick={() => { setStatusDraft({ current_status: client.current_status ?? '', update_status: client.update_status ?? '', quick_buttons: client.quick_buttons ?? '' }); setStatusEdit(true); }}
                className="mt-3 text-xs text-blue-600 font-medium hover:underline">Change status</button>
            )}
            {isLeadership && !mergeOpen && (
              <button onClick={() => setMergeOpen(true)} className="mt-3 ml-4 text-xs text-gray-500 font-medium hover:underline">Merge duplicate</button>
            )}
            {mergeOpen && (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="text-xs font-medium text-amber-800 mb-2">Merge a duplicate INTO this client (the duplicate is absorbed in Pipedrive itself; cannot be undone)</div>
                <input value={mergeQuery} onChange={e => searchMergeCands(e.target.value)} placeholder="Search the duplicate by name, email, or phone..."
                  className="w-full border rounded-md p-2 text-sm mb-2" autoFocus />
                {mergeCands.map(m => (
                  <button key={m.pipedrive_person_id} onClick={() => mergeDuplicate(m)} disabled={merging}
                    className="block w-full text-left text-xs p-2 rounded hover:bg-amber-100 disabled:opacity-50">
                    <b>{m.name}</b> #{m.pipedrive_person_id} - {m.email || 'no email'} {m.phone ? `- ${m.phone}` : ''}
                  </button>
                ))}
                <button onClick={() => { setMergeOpen(false); setMergeQuery(''); setMergeCands([]); }} className="text-xs text-gray-500 mt-1 hover:underline">Cancel</button>
              </div>
            )}
            {statusEdit && (
              <div className="mt-3 flex flex-wrap items-end gap-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                {[['current_status', 'Current Status'], ['update_status', 'Update Status'], ['quick_buttons', 'Quick Buttons']].map(([k, lbl]) => (
                  <label key={k} className="text-xs text-gray-600">
                    <div className="mb-1 font-medium">{lbl}</div>
                    <select value={statusDraft[k] ?? ''} onChange={e => setStatusDraft({ ...statusDraft, [k]: e.target.value })}
                      className="border rounded-md p-1.5 text-sm bg-white min-w-[180px]">
                      <option value="">(no change)</option>
                      {optList(k).map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>
                  </label>
                ))}
                <div className="flex gap-2">
                  <button onClick={saveStatus} disabled={savingStatus} className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium disabled:opacity-50">{savingStatus ? 'Saving...' : 'Save'}</button>
                  <button onClick={() => { setStatusEdit(false); setStatusDraft({}); }} className="px-3 py-1.5 border rounded-md text-sm">Cancel</button>
                </div>
                <div className="text-[11px] text-gray-500 w-full">Saves to Pipedrive too - all existing automations fire as normal.</div>
              </div>
            )}
            <div className="mt-3 text-xs text-gray-500">
              {client.account_manager_name && <span className="mr-4">AM: <b>{client.account_manager_name}</b></span>}
              {client.owner_name && <span className="mr-4">Consultant: <b>{client.owner_name}</b></span>}
              <span>Client since {fmtDate(client.pd_add_time)}</span>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-5">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><FileText className="w-4 h-4 text-blue-600" /> Deals ({deals.length})</h3>
            {deals.length === 0 && <div className="text-sm text-gray-500">No deals on file.</div>}
            <div className="space-y-3">
              {deals.map(d => {
                const dealRounds = rounds.filter(r => r.pipedrive_deal_id === d.pipedrive_deal_id).sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''));
                return (
                  <div key={d.pipedrive_deal_id} className="border rounded-lg p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-medium">{d.title} <span className="text-xs text-gray-400">#{d.pipedrive_deal_id}</span></div>
                      <div className="flex gap-2">
                        <Badge color={d.status === 'won' ? 'bg-green-100 text-green-800' : d.status === 'lost' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-800'}>{d.status}</Badge>
                        {stageEditId !== d.pipedrive_deal_id && (
                          <>
                            <Badge color="bg-gray-100 text-gray-700">{d.stage_name || `stage ${d.stage_id}`}</Badge>
                            {d.status === 'open' && (
                              <button onClick={() => openStageEdit(d)} className="text-xs text-blue-600 font-medium hover:underline">Move</button>
                            )}
                          </>
                        )}
                        {stageEditId === d.pipedrive_deal_id && (
                          <span className="flex items-center gap-1.5">
                            <select value={stageDraft} onChange={e => setStageDraft(e.target.value)} className="border rounded-md p-1 text-xs bg-white max-w-[220px]">
                              {stageCatalog.map(p => (
                                <optgroup key={p.id} label={p.name}>
                                  {p.stages.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
                                </optgroup>
                              ))}
                            </select>
                            <button onClick={() => moveStage(d)} disabled={savingStage} className="text-xs bg-blue-600 text-white rounded px-2 py-1 disabled:opacity-50">{savingStage ? '...' : 'Save'}</button>
                            <button onClick={() => setStageEditId(null)} className="text-xs text-gray-500 px-1">Cancel</button>
                          </span>
                        )}
                        {d.value ? <Badge color="bg-emerald-100 text-emerald-800">${Number(d.value).toLocaleString()}</Badge> : null}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5">
                      {d.payment_type !== null && <span>Payment: {opt('payment_type', d.payment_type)}</span>}
                      {d.partial_fee_date && <span>Partial due {fmtDate(d.partial_fee_date)}</span>}
                      {d.final_fee_date && <span>Final due {fmtDate(d.final_fee_date)}</span>}
                      {d.moved_into_pipeline && <span>In pipeline {fmtDate(d.moved_into_pipeline)}</span>}
                    </div>
                    {dealRounds.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {dealRounds.map(r => (
                          <span key={r.round_label} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded">
                            <b>{r.round_label}</b> {fmtDate(r.start_date)}{r.end_date ? ` - ${fmtDate(r.end_date)}` : ''}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-5">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><DollarSign className="w-4 h-4 text-green-600" /> Payments ({payments.length})</h3>
            {payments.length === 0 && <div className="text-sm text-gray-500">No payments on file.</div>}
            {payments.length > 0 && (
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-gray-500 border-b"><th className="py-1.5">Date</th><th>Type</th><th>Amount</th><th>Consultant</th><th className="text-right">Deal</th></tr></thead>
                <tbody>
                  {payments.map((p, i) => (
                    <tr key={i} className="border-b last:border-b-0">
                      <td className="py-1.5">{fmtDate(p.payment_date)}</td>
                      <td>{p.payment_type}</td>
                      <td className="font-medium">${Number(p.amount || 0).toLocaleString()}</td>
                      <td>{p.consultant_name || '-'}</td>
                      <td className="text-right text-xs text-gray-400">#{p.pipedrive_deal_id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="bg-white rounded-lg shadow">
            <div className="flex border-b">
              <button onClick={() => setTab('notes')} className={`px-5 py-3 text-sm font-medium flex items-center gap-1.5 ${tab === 'notes' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}><MessageSquare className="w-4 h-4" /> Notes ({notes.length})</button>
              <button onClick={() => setTab('activities')} className={`px-5 py-3 text-sm font-medium flex items-center gap-1.5 ${tab === 'activities' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}><CheckSquare className="w-4 h-4" /> Activities ({activities.length})</button>
            </div>
            {tab === 'notes' && (
              <div className="p-4 pb-0 flex gap-2">
                <textarea value={noteDraft} onChange={e => setNoteDraft(e.target.value)} rows={2}
                  placeholder="Add a note - posts here and to Pipedrive..."
                  className="flex-1 border rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <button onClick={postNote} disabled={postingNote || !noteDraft.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 self-start">
                  {postingNote ? 'Posting...' : 'Post'}
                </button>
              </div>
            )}
            <div className="p-5 space-y-3 max-h-96 overflow-y-auto">
              {tab === 'notes' && notes.map((n, i) => (
                <div key={i} className={`border rounded-lg p-3 ${n.pinned ? 'border-amber-300 bg-amber-50' : ''}`}>
                  <div className="text-xs text-gray-500 mb-1 flex items-center gap-2"><Calendar className="w-3 h-3" />{fmtDT(n.pd_add_time)} {n.author && <span>- {n.author}</span>} {n.pinned && <Badge color="bg-amber-100 text-amber-800">pinned</Badge>}</div>
                  <div className="text-sm whitespace-pre-wrap">{stripHtml(n.content)}</div>
                </div>
              ))}
              {tab === 'notes' && notes.length === 0 && <div className="text-sm text-gray-500">No notes on file.</div>}
              {tab === 'activities' && (
                <div className="flex gap-2 pb-1">
                  <input value={taskDraft} onChange={e => setTaskDraft(e.target.value)} placeholder="Add a task - posts here and to Pipedrive..."
                    className="flex-1 border rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <input type="date" value={taskDue} onChange={e => setTaskDue(e.target.value)} className="border rounded-lg p-2 text-sm" />
                  <button onClick={createTask} disabled={postingTask || !taskDraft.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">{postingTask ? 'Adding...' : 'Add'}</button>
                </div>
              )}
              {tab === 'activities' && activities.map((a, i) => (
                <div key={i} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">{a.subject || '(no subject)'}</div>
                    <div className="flex items-center gap-2">
                      <Badge color={a.done ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>{a.done ? 'done' : 'open'}</Badge>
                      {!a.done && a.pipedrive_activity_id && (
                        <button onClick={() => completeActivity(a)} disabled={completingId === a.pipedrive_activity_id}
                          className="text-xs text-green-700 font-medium hover:underline disabled:opacity-50">
                          {completingId === a.pipedrive_activity_id ? 'Saving...' : 'Mark done'}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{a.activity_type} - {fmtDT(a.pd_add_time)} {a.due_date && `- due ${fmtDate(a.due_date)}`} {a.owner_name && `- ${a.owner_name}`}</div>
                  {a.note && <div className="text-xs text-gray-600 mt-1">{stripHtml(a.note)}</div>}
                </div>
              ))}
              {tab === 'activities' && activities.length === 0 && <div className="text-sm text-gray-500">No activities on file.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default ClientFile;
