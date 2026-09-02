import React, { useState } from 'react';
import { Search, Save, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

const SUPABASE_URL = 'https://kkcbpqbcpzcarxhknzza.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzM3MDM2MCwiZXhwIjoyMDgyOTQ2MzYwfQ.iYOuxOZIyKPsxqY_Wt-1PQ7Yn4QE8d7Raae58ei4qFM';
const H = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };

// Admin tool for consult_deals (Joe 9/2, Rosalia's 2 bad-lead consults): lets the team
// correct a consult's owner, month, and whether it counts toward closing % - without
// needing a direct database edit each time.
function AdminConsults() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(null);
  const [msg, setMsg] = useState(null);

  async function search() {
    if (!query.trim()) return;
    setLoading(true); setMsg(null);
    try {
      const isId = /^\d+$/.test(query.trim());
      const filter = isId
        ? `deal_id=eq.${query.trim()}`
        : `person_name=ilike.*${encodeURIComponent(query.trim())}*`;
      const res = await fetch(`${SUPABASE_URL}/rest/v1/consult_deals?${filter}&select=*&order=add_time.desc&limit=25`, { headers: H });
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
      if (!data.length) setMsg({ type: 'info', text: 'No matching consults found.' });
    } catch (e) {
      setMsg({ type: 'error', text: 'Search failed: ' + e.message });
    } finally { setLoading(false); }
  }

  function update(dealId, field, value) {
    setResults(r => r.map(x => x.deal_id === dealId ? { ...x, [field]: value } : x));
  }

  async function save(row) {
    setSaving(row.deal_id); setMsg(null);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/consult_deals?deal_id=eq.${row.deal_id}`, {
        method: 'PATCH', headers: { ...H, Prefer: 'return=representation' },
        body: JSON.stringify({ owner_name: row.owner_name, rtq_month: row.rtq_month, in_rtq: row.in_rtq }),
      });
      if (!res.ok) throw new Error(await res.text());
      setMsg({ type: 'success', text: `Saved ${row.person_name} (deal ${row.deal_id}).` });
    } catch (e) {
      setMsg({ type: 'error', text: 'Save failed: ' + e.message });
    } finally { setSaving(null); }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Consult Records</h1>
      <p className="text-slate-500 mb-6">Search a deal by ID or client name. Fix the owner, the month it counts toward, or exclude it from closing % entirely.</p>

      <div className="flex gap-2 mb-6">
        <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()}
          placeholder="Deal ID or client name..." className="flex-1 border border-slate-300 rounded-lg px-4 py-2" />
        <button onClick={search} disabled={loading} className="px-4 py-2 bg-asap-blue text-white rounded-lg flex items-center gap-2">
          <Search size={16} /> {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {msg && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 text-sm ${msg.type === 'success' ? 'bg-green-50 text-green-700' : msg.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-slate-50 text-slate-600'}`}>
          {msg.type === 'success' ? <CheckCircle size={16} /> : msg.type === 'error' ? <XCircle size={16} /> : <AlertTriangle size={16} />}
          {msg.text}
        </div>
      )}

      {results.map(row => (
        <div key={row.deal_id} className="border border-slate-200 rounded-xl p-4 mb-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-semibold text-slate-800">{row.person_name}</div>
              <div className="text-xs text-slate-400">Deal #{row.deal_id} · {row.title}</div>
            </div>
            <button onClick={() => save(row)} disabled={saving === row.deal_id}
              className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm flex items-center gap-1.5">
              <Save size={14} /> {saving === row.deal_id ? 'Saving...' : 'Save'}
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <label className="block text-slate-500 mb-1">Owner</label>
              <input value={row.owner_name || ''} onChange={e => update(row.deal_id, 'owner_name', e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-2 py-1.5" />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">Counts toward month</label>
              <input value={row.rtq_month || ''} onChange={e => update(row.deal_id, 'rtq_month', e.target.value)}
                placeholder="2026-08" className="w-full border border-slate-300 rounded-lg px-2 py-1.5" />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">Counts toward closing %</label>
              <select value={row.in_rtq ? 'yes' : 'no'} onChange={e => update(row.deal_id, 'in_rtq', e.target.value === 'yes')}
                className="w-full border border-slate-300 rounded-lg px-2 py-1.5">
                <option value="yes">Yes</option>
                <option value="no">No (excluded)</option>
              </select>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default AdminConsults;
