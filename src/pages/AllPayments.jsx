import React, { useState, useEffect } from 'react';
import { DollarSign, Plus, Search, RefreshCw, X, Check } from 'lucide-react';

const SUPABASE_URL = 'https://kkcbpqbcpzcarxhknzza.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0';

const PAYMENT_TYPES = ['doc_fee', 'partial', 'final', 'paid_in_full'];
const fmt = (n) => '$' + (Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const monthKey = (d) => d.toISOString().slice(0, 7);

function AllPayments() {
  const now = new Date();
  const [month, setMonth] = useState('all');
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
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

  const runSync = async () => {
    setSyncing(true); setMsg(null);
    try {
      const syncMonth = month === 'all' ? monthKey(new Date()) : month;
      await fetch(`/.netlify/functions/zoho-payment-sync?month=${syncMonth}`);
      await load();
      setMsg({ ok: true, text: month === 'all' ? `Synced ${syncMonth} from Zoho.` : 'Synced from Zoho.' });
    } catch (e) { setMsg({ ok: false, text: 'Sync failed.' }); }
    setSyncing(false);
  };

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
      const res = await fetch(`/.netlify/functions/all-payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error || 'error');
      setMsg({ ok: true, text: 'Payment added.' });
      setShowAdd(false);
      const addedMonth = form.payment_date.slice(0, 7);
      setForm({ client_name: '', amount: '', payment_type: 'doc_fee', payment_date: new Date().toISOString().slice(0, 10), consultant_name: '', pipedrive_deal_id: '' });
      if (month !== 'all' && addedMonth !== month) setMonth(addedMonth); else load();
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
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-800">All Payments</h1>
          <p className="text-slate-500">Every payment from Zoho, plus any added manually. Use this to spot what's missing and add payments by hand.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={runSync} disabled={syncing} className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium disabled:opacity-50">
            <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} /> {syncing ? 'Syncing...' : 'Sync from Zoho'}
          </button>
          <button onClick={() => { setShowAdd(true); setMsg(null); }} className="flex items-center gap-2 px-4 py-2.5 bg-asap-blue text-white rounded-xl font-medium hover:bg-blue-600">
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
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 text-slate-500">{p.payment_date || ''}</td>
                    <td className="px-5 py-3 font-medium text-slate-800">{p.client_name || '—'}</td>
                    <td className="px-5 py-3 text-slate-600">{(p.payment_type || '').replace(/_/g, ' ')}</td>
                    <td className="px-5 py-3 text-slate-600">{p.consultant_name && p.consultant_name !== 'pending_enrichment' ? p.consultant_name : '—'}</td>
                    <td className="px-5 py-3 text-slate-500">{p.pipedrive_deal_id || '—'}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${p.zoho_payment_id ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-700'}`}>{p.zoho_payment_id ? 'Zoho' : 'Manual'}</span>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-slate-800">{fmt(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-slate-800">Add Payment Manually</h3>
              <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
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
                  {PAYMENT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Consultant (optional)</label>
                  <input value={form.consultant_name} onChange={e => setForm({ ...form, consultant_name: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Name" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Deal ID (optional)</label>
                  <input value={form.pipedrive_deal_id} onChange={e => setForm({ ...form, pipedrive_deal_id: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="266528" />
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowAdd(false)} className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200">Cancel</button>
              <button onClick={saveManual} disabled={saving} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-asap-blue text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50">
                <Check size={16} /> {saving ? 'Saving...' : 'Add Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AllPayments;
