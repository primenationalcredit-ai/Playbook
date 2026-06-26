import React, { useState, useEffect, useRef } from 'react';
import { DollarSign, Plus, Search, RefreshCw, X, Check, Pencil } from 'lucide-react';

const SUPABASE_URL = 'https://kkcbpqbcpzcarxhknzza.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0';

const PAYMENT_TYPES = ['doc_fee', 'partial', 'final', 'additional_round', 'paid_in_full'];
const TYPE_LABELS = {
  doc_fee: 'Doc Fee',
  partial: 'Partial Payment',
  final: 'Final Payment',
  additional_round: '2 Additional Rounds',
  paid_in_full: 'Paid In Full',
  unknown: 'Unknown',
};
const typeLabel = (t) => TYPE_LABELS[t] || String(t || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const fmtDate = (s) => {
  if (!s) return '';
  const p = String(s).slice(0, 10).split('-'); // YYYY-MM-DD
  return p.length === 3 ? `${p[1]}-${p[2]}-${p[0]}` : s;
};
const fmt = (n) => '$' + (Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const monthKey = (d) => d.toISOString().slice(0, 7);

function AllPayments({ embedded = false }) {
  const now = new Date();
  const [month, setMonth] = useState('all');
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [remaining, setRemaining] = useState(null);
  const autoRan = useRef(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState(null);
  const [consultants, setConsultants] = useState([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [form, setForm] = useState({ client_name: '', amount: '', payment_type: 'doc_fee', payment_date: now.toISOString().slice(0, 10), consultant_name: '', pipedrive_deal_id: '' });

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/.netlify/functions/all-payments?month=${month}`);
      const data = await res.json();
      setPayments(Array.isArray(data.payments) ? data.payments : []);
    } catch (e) { /* noop */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, [month]);

  // Load the credit consultant roster once so the edit form can offer a pick list
  // instead of free typing. Sorted by name. Free text is still allowed as a fallback.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/users?department=eq.credit_consultants&select=name&order=name.asc`, {
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        });
        if (res.ok) {
          const rows = await res.json();
          const names = Array.from(new Set((rows || []).map(u => (u.name || '').trim()).filter(Boolean)));
          setConsultants(names);
        }
      } catch (e) { /* noop — form falls back to free text */ }
    })();
  }, []);

  // Auto-run enrichment to completion once when the tab opens
  useEffect(() => {
    if (autoRan.current) return;
    autoRan.current = true;
    runEnrich(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runSync = async () => {
    setSyncing(true); setMsg(null);
    try {
      const syncMonth = month === 'all' ? monthKey(new Date()) : month;
      let url = `/.netlify/functions/zoho-payment-sync?month=${syncMonth}`;
      let totalNew = 0, pages = 0;
      while (url && pages < 300) {
        const r = await fetch(url);
        const d = await r.json().catch(() => ({}));
        totalNew += (d.newRecords || 0);
        pages++;
        url = d.nextUrl || null;
        if (pages % 5 === 0) await load(); // show progress as pages come in
      }
      await load();
      setMsg({ ok: true, text: `Synced ${syncMonth}: ${totalNew} new payment${totalNew === 1 ? '' : 's'} across ${pages} page${pages === 1 ? '' : 's'}.` });
    } catch (e) { setMsg({ ok: false, text: 'Sync failed.' }); }
    setSyncing(false);
  };

  const runEnrich = async (auto = false) => {
    if (enriching) return;
    setEnriching(true);
    if (!auto) setMsg(null);
    let total = 0, rounds = 0, rem = 1, stalled = false;
    try {
      while (rem > 0 && rounds < 800) {
        const r = await fetch(`/.netlify/functions/payment-enrich`);
        const d = await r.json().catch(() => ({}));
        const got = d.enriched || 0;
        total += got;
        rem = typeof d.remaining === 'number' ? d.remaining : 0;
        setRemaining(rem);
        rounds++;
        if (got === 0) { stalled = rem > 0; break; } // no progress — remaining rows can't be matched right now
        if (rounds % 10 === 0) await load(); // refresh the list periodically so names appear as they fill
      }
      await load();
      setMsg({
        ok: true,
        text: total
          ? `Filled in ${total} consultant name${total === 1 ? '' : 's'}.${rem ? (stalled ? ` ${rem.toLocaleString()} couldn't be matched (deleted or merged deals).` : ` ${rem.toLocaleString()} still pending.`) : ' All caught up.'}`
          : (rem ? `${rem.toLocaleString()} couldn't be matched — their Pipedrive deals are likely deleted or merged.` : 'All caught up. Nothing to enrich.'),
      });
    } catch (e) { setMsg({ ok: false, text: 'Could not pull names.' }); }
    setEnriching(false);
  };

  const blankForm = () => ({ client_name: '', amount: '', payment_type: 'doc_fee', payment_date: new Date().toISOString().slice(0, 10), consultant_name: '', pipedrive_deal_id: '' });

  const openAdd = () => {
    setEditId(null);
    setForm(blankForm());
    setMsg(null);
    setShowAdd(true);
  };

  const openEdit = (p) => {
    setEditId(p.id);
    setForm({
      client_name: p.client_name || '',
      amount: p.amount != null ? String(p.amount) : '',
      payment_type: p.payment_type || 'doc_fee',
      payment_date: String(p.payment_date || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
      // never carry the internal placeholder into the editable field
      consultant_name: (p.consultant_name && p.consultant_name !== 'pending_enrichment') ? p.consultant_name : '',
      pipedrive_deal_id: p.pipedrive_deal_id || '',
    });
    setMsg(null);
    setShowAdd(true);
  };

  const closeModal = () => { setShowAdd(false); setEditId(null); };

  const saveManual = async () => {
    if (!form.client_name.trim() || !form.amount || !form.payment_date) {
      setMsg({ ok: false, text: 'Client, amount, and date are required.' }); return;
    }
    setSaving(true); setMsg(null);
    try {
      const body = {
        client_name: form.client_name.trim(),
        amount: parseFloat(form.amount),
        payment_type: form.payment_type,
        payment_date: form.payment_date,
        consultant_name: form.consultant_name.trim() || null,
        pipedrive_deal_id: form.pipedrive_deal_id.trim() || null,
      };
      let res;
      if (editId) {
        res = await fetch(`/.netlify/functions/all-payments`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editId, ...body }),
        });
      } else {
        res = await fetch(`/.netlify/functions/all-payments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error || 'error');
      setMsg({ ok: true, text: editId ? 'Payment updated.' : 'Payment added.' });
      const wasEdit = !!editId;
      closeModal();
      const addedMonth = form.payment_date.slice(0, 7);
      setForm(blankForm());
      if (!wasEdit && month !== 'all' && addedMonth !== month) setMonth(addedMonth); else load();
    } catch (e) {
      setMsg({ ok: false, text: 'Could not save: ' + (e.message || 'error').slice(0, 140) });
    }
    setSaving(false);
  };

  const filtered = payments.filter(p => !search || (p.client_name || '').toLowerCase().includes(search.toLowerCase()) || String(p.pipedrive_deal_id || '').includes(search));
  const total = filtered.reduce((s, p) => s + (Number(p.amount) || 0), 0);

  const monthOptions = ['all'];
  for (let i = 0; i < 12; i++) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); monthOptions.push(monthKey(d)); }

  return (
    <div className={embedded ? '' : 'p-6 lg:p-8 max-w-7xl mx-auto'}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        {!embedded && (
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-slate-800">All Payments</h1>
            <p className="text-slate-500">Every payment from Zoho, plus any added manually. Use this to spot what's missing and add payments by hand.</p>
          </div>
        )}
        <div className={`flex gap-2 flex-wrap ${embedded ? 'ml-auto' : ''}`}>
          {remaining !== null && remaining > 0 && (
            <span className="self-center text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 whitespace-nowrap">{remaining.toLocaleString()} left to enrich</span>
          )}
          {remaining === 0 && (
            <span className="self-center text-xs font-medium px-2.5 py-1 rounded-full bg-green-100 text-green-700 whitespace-nowrap">All enriched</span>
          )}
          <button onClick={() => runEnrich(false)} disabled={enriching} className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium disabled:opacity-50" title="Look up the deal owner in Pipedrive for any payment showing pending">
            <RefreshCw size={18} className={enriching ? 'animate-spin' : ''} /> {enriching ? (remaining != null ? `Enriching… ${remaining.toLocaleString()} left` : 'Enriching…') : 'Pull consultant names'}
          </button>
          <button onClick={runSync} disabled={syncing} className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium disabled:opacity-50">
            <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} /> {syncing ? 'Syncing...' : 'Sync from Zoho'}
          </button>
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 bg-asap-blue text-white rounded-xl font-medium hover:bg-blue-600">
            <Plus size={18} /> Add Payment
          </button>
        </div>
      </div>

      {msg && <div className={`mb-4 text-sm px-4 py-2 rounded-lg ${msg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{msg.text}</div>}

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <select value={month} onChange={e => setMonth(e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
          {monthOptions.map(m => <option key={m} value={m}>{m === 'all' ? 'All time' : m}</option>)}
        </select>
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search client or deal ID" className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" />
        </div>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between text-sm">
          <span className="text-slate-500">{filtered.length} payment{filtered.length === 1 ? '' : 's'}</span>
          <span className="font-semibold text-slate-800">Total: {fmt(total)}</span>
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No payments for this month yet. Try Sync from Zoho, or add one manually.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-left">
                <tr>
                  <th className="px-5 py-2 font-medium">Date</th>
                  <th className="px-5 py-2 font-medium">Client</th>
                  <th className="px-5 py-2 font-medium">Type</th>
                  <th className="px-5 py-2 font-medium">Consultant</th>
                  <th className="px-5 py-2 font-medium">Deal</th>
                  <th className="px-5 py-2 font-medium">Source</th>
                  <th className="px-5 py-2 font-medium text-right">Amount</th>
                  <th className="px-5 py-2 font-medium text-right">Edit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 text-slate-500">{fmtDate(p.payment_date)}</td>
                    <td className="px-5 py-3 font-medium text-slate-800">{p.client_name || '—'}</td>
                    <td className="px-5 py-3 text-slate-600">{typeLabel(p.payment_type)}</td>
                    <td className="px-5 py-3 text-slate-600">{p.consultant_name && p.consultant_name !== 'pending_enrichment' ? p.consultant_name : '—'}</td>
                    <td className="px-5 py-3 text-slate-500">{p.pipedrive_deal_id || '—'}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${p.zoho_payment_id ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-700'}`}>{p.zoho_payment_id ? 'Zoho' : 'Manual'}</span>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-slate-800">{fmt(p.amount)}</td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => openEdit(p)} className="inline-flex items-center gap-1 text-xs font-medium text-asap-blue hover:underline" title="Edit this payment (fix consultant, deal, amount, etc.)">
                        <Pencil size={13} /> Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={closeModal}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-slate-800">{editId ? 'Edit Payment' : 'Add Payment Manually'}</h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Client Name *</label>
                <input value={form.client_name} onChange={e => setForm({ ...form, client_name: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="John Smith" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Amount *</label>
                  <input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="149.00" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Date *</label>
                  <input type="date" value={form.payment_date} onChange={e => setForm({ ...form, payment_date: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Type</label>
                <select value={form.payment_type} onChange={e => setForm({ ...form, payment_type: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                  {PAYMENT_TYPES.map(t => <option key={t} value={t}>{typeLabel(t)}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Consultant (optional)</label>
                  <select
                    value={consultants.includes(form.consultant_name) || form.consultant_name === '' ? form.consultant_name : '__other__'}
                    onChange={e => setForm({ ...form, consultant_name: e.target.value === '__other__' ? ' ' : e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                  >
                    <option value="">— None —</option>
                    {consultants.map(n => <option key={n} value={n}>{n}</option>)}
                    <option value="__other__">Other (type a name)</option>
                  </select>
                  {!(consultants.includes(form.consultant_name) || form.consultant_name === '') && (
                    <input
                      value={form.consultant_name.trim() === '' ? '' : form.consultant_name}
                      onChange={e => setForm({ ...form, consultant_name: e.target.value })}
                      className="w-full mt-2 px-3 py-2 border rounded-lg text-sm"
                      placeholder="Type consultant name"
                      autoFocus
                    />
                  )}
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Deal ID (optional)</label>
                  <input value={form.pipedrive_deal_id} onChange={e => setForm({ ...form, pipedrive_deal_id: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="266528" />
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={closeModal} className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200">Cancel</button>
              <button onClick={saveManual} disabled={saving} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-asap-blue text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50">
                <Check size={16} /> {saving ? 'Saving...' : (editId ? 'Save Changes' : 'Add Payment')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AllPayments;
