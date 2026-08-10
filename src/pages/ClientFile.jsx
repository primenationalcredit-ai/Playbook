import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
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
  const debounceRef = useRef(null);

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
      const safe = q.replace(/[%,()]/g, ' ').trim();
      const { data } = await supabase.from('crm_clients')
        .select('pipedrive_person_id,name,email,phone,current_status,account_manager_name,owner_name')
        .or(`name.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%`)
        .eq('deleted', false).limit(20);
      setResults(data || []);
      setSearching(false);
    }, 300);
  }, [query]);

  const openClient = async (row) => {
    setLoading(true); setClient(row); setResults([]); setQuery(row.name || '');
    const pid = row.pipedrive_person_id;
    const { data: full } = await supabase.from('crm_clients').select('*').eq('pipedrive_person_id', pid).limit(1);
    if (full && full[0]) setClient(full[0]);
    const { data: ds } = await supabase.from('crm_deals').select('*').eq('pipedrive_person_id', pid).order('pd_add_time', { ascending: false });
    const dealList = ds || [];
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
      supabase.from('crm_activities').select('pd_add_time,subject,activity_type,done,due_date,owner_name,note').or(orFilter).order('pd_add_time', { ascending: false }).limit(40)
    ]);
    setNotes(ns || []); setActivities(as || []);
    setLoading(false);
  };

  const Badge = ({ children, color }) => children ? (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${color || 'bg-blue-100 text-blue-800'}`}>{children}</span>
  ) : null;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-1"><User className="w-6 h-6 text-blue-600" /><h1 className="text-2xl font-bold">Clients</h1></div>
      <p className="text-sm text-gray-500 mb-4">Search the full client base - served from our own database. Read-only for now; edits still happen in Pipedrive.</p>
      <div className="relative mb-6">
        <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name, email, or phone..."
          className="w-full pl-9 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        {searching && <Loader2 className="w-4 h-4 absolute right-3 top-3 animate-spin text-gray-400" />}
        {results.length > 0 && (
          <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-80 overflow-y-auto">
            {results.map(r => (
              <button key={r.pipedrive_person_id} onClick={() => openClient(r)} className="w-full text-left px-4 py-2 hover:bg-blue-50 border-b last:border-b-0">
                <div className="font-medium">{r.name}</div>
                <div className="text-xs text-gray-500">{r.email || 'no email'} {r.phone ? `- ${r.phone}` : ''} {r.account_manager_name ? `- AM: ${r.account_manager_name}` : ''}</div>
              </button>
            ))}
          </div>
        )}
      </div>
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
                        <Badge color="bg-gray-100 text-gray-700">{d.stage_name || `stage ${d.stage_id}`}</Badge>
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
            <div className="p-5 space-y-3 max-h-96 overflow-y-auto">
              {tab === 'notes' && notes.map((n, i) => (
                <div key={i} className={`border rounded-lg p-3 ${n.pinned ? 'border-amber-300 bg-amber-50' : ''}`}>
                  <div className="text-xs text-gray-500 mb-1 flex items-center gap-2"><Calendar className="w-3 h-3" />{fmtDT(n.pd_add_time)} {n.author && <span>- {n.author}</span>} {n.pinned && <Badge color="bg-amber-100 text-amber-800">pinned</Badge>}</div>
                  <div className="text-sm whitespace-pre-wrap">{stripHtml(n.content)}</div>
                </div>
              ))}
              {tab === 'notes' && notes.length === 0 && <div className="text-sm text-gray-500">No notes on file.</div>}
              {tab === 'activities' && activities.map((a, i) => (
                <div key={i} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">{a.subject || '(no subject)'}</div>
                    <Badge color={a.done ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>{a.done ? 'done' : 'open'}</Badge>
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
