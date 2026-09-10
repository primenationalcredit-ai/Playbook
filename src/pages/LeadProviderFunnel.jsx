import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { TrendingUp, TrendingDown, Phone, CheckCircle2, DollarSign, Link2, X } from 'lucide-react';

const STAGES = [
  { key: 'transferred', label: 'Transferred' },
  { key: 'idiq_signup', label: 'IDIQ Signup' },
  { key: 'client_signed', label: 'Became a Client' },
];

const SUPABASE_URL = 'https://kkcbpqbcpzcarxhknzza.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzM3MDM2MCwiZXhwIjoyMDgyOTQ2MzYwfQ.iYOuxOZIyKPsxqY_Wt-1PQ7Yn4QE8d7Raae58ei4qFM';
const SB = { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' };

function fmtMoney(n) {
  return (n < 0 ? '-$' : '$') + Math.abs(Number(n || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtDuration(s) {
  const m = Math.floor((s || 0) / 60), sec = (s || 0) % 60;
  return `${m}m ${sec}s`;
}

export default function LeadProviderFunnel() {
  const { currentUser } = useApp();
  const isLeadership = currentUser?.role === 'admin' || currentUser?.department === 'leadership';

  const [calls, setCalls] = useState([]);
  const [revenueByDeal, setRevenueByDeal] = useState({});
  const [loading, setLoading] = useState(true);
  const [editingCall, setEditingCall] = useState(null);
  const [editDealId, setEditDealId] = useState('');
  const [editStage, setEditStage] = useState('transferred');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const callsRes = await fetch(`${SUPABASE_URL}/rest/v1/lead_provider_calls?select=*&order=call_start.desc&limit=1000`, { headers: SB });
      const callsJson = await callsRes.json().catch(() => []);
      const list = Array.isArray(callsJson) ? callsJson : [];
      setCalls(list);

      const dealIds = [...new Set(list.filter(c => c.pipedrive_deal_id).map(c => c.pipedrive_deal_id))];
      if (dealIds.length > 0) {
        const payRes = await fetch(`${SUPABASE_URL}/rest/v1/consultant_payments?pipedrive_deal_id=in.(${dealIds.join(',')})&select=pipedrive_deal_id,amount`, { headers: SB });
        const payJson = await payRes.json().catch(() => []);
        const rev = {};
        (Array.isArray(payJson) ? payJson : []).forEach(p => {
          rev[p.pipedrive_deal_id] = (rev[p.pipedrive_deal_id] || 0) + parseFloat(p.amount || 0);
        });
        setRevenueByDeal(rev);
      } else {
        setRevenueByDeal({});
      }
    } catch (e) { /* leave state as-is on failure */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openEdit = (call) => {
    setEditingCall(call);
    setEditDealId(call.pipedrive_deal_id || '');
    setEditStage(call.funnel_stage || 'transferred');
  };

  const saveEdit = async () => {
    if (!editingCall) return;
    setSaving(true);
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/lead_provider_calls?id=eq.${editingCall.id}`, {
        method: 'PATCH', headers: { ...SB, Prefer: 'return=minimal' },
        body: JSON.stringify({ pipedrive_deal_id: editDealId.trim() || null, funnel_stage: editStage })
      });
      setEditingCall(null);
      await load();
    } catch (e) {}
    setSaving(false);
  };

  const stats = useMemo(() => {
    const qualifying = calls.filter(c => c.qualifying);
    const totalSpend = qualifying.reduce((sum, c) => sum + parseFloat(c.payout_amount || 0), 0);
    const totalRevenue = Object.values(revenueByDeal).reduce((sum, v) => sum + v, 0);
    const stageCounts = {};
    STAGES.forEach(s => { stageCounts[s.key] = calls.filter(c => (c.funnel_stage || 'transferred') === s.key).length; });
    const clientsSigned = stageCounts['client_signed'] || 0;
    const conversionRate = qualifying.length > 0 ? (clientsSigned / qualifying.length) * 100 : 0;
    return { totalCalls: calls.length, qualifyingCalls: qualifying.length, totalSpend, totalRevenue, netPL: totalRevenue - totalSpend, stageCounts, conversionRate };
  }, [calls, revenueByDeal]);

  if (!isLeadership) {
    return <div className="p-6 text-center text-slate-500">Leadership access only.</div>;
  }

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl lg:text-3xl font-bold text-slate-800 mb-2">Lead Provider Funnel &amp; P&amp;L</h1>
        <p className="text-slate-500">Vertimedia live-transfer performance, conversion, and profitability.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border shadow-sm p-4">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold uppercase mb-1"><Phone size={14} /> Total Calls</div>
          <div className="text-2xl font-bold text-slate-800">{stats.totalCalls}</div>
          <div className="text-xs text-slate-400 mt-1">{stats.qualifyingCalls} qualifying</div>
        </div>
        <div className="bg-white rounded-xl border shadow-sm p-4">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold uppercase mb-1"><CheckCircle2 size={14} /> Became Clients</div>
          <div className="text-2xl font-bold text-slate-800">{stats.stageCounts.client_signed || 0}</div>
          <div className="text-xs text-slate-400 mt-1">{stats.conversionRate.toFixed(1)}% of qualifying calls</div>
        </div>
        <div className="bg-white rounded-xl border shadow-sm p-4">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold uppercase mb-1"><DollarSign size={14} /> Total Spend</div>
          <div className="text-2xl font-bold text-red-600">{fmtMoney(stats.totalSpend)}</div>
          <div className="text-xs text-slate-400 mt-1">$30 × qualifying calls</div>
        </div>
        <div className="bg-white rounded-xl border shadow-sm p-4">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold uppercase mb-1">
            {stats.netPL >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />} Net P&amp;L
          </div>
          <div className={`text-2xl font-bold ${stats.netPL >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmtMoney(stats.netPL)}</div>
          <div className="text-xs text-slate-400 mt-1">Revenue {fmtMoney(stats.totalRevenue)} − Spend {fmtMoney(stats.totalSpend)}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border shadow-sm p-5 mb-6">
        <h2 className="text-sm font-bold text-slate-700 mb-4">Funnel</h2>
        <div className="flex items-center gap-2">
          {STAGES.map((s, i) => (
            <React.Fragment key={s.key}>
              <div className="flex-1 bg-slate-50 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-slate-800">{stats.stageCounts[s.key] || 0}</div>
                <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
              </div>
              {i < STAGES.length - 1 && <div className="text-slate-300">→</div>}
            </React.Fragment>
          ))}
        </div>
      </div>

      {editingCall && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800">Tag Call</h2>
              <button onClick={() => setEditingCall(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <p className="text-xs text-slate-400 mb-4">{fmtDate(editingCall.call_start)} · {fmtDuration(editingCall.duration_seconds)}</p>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Funnel Stage</label>
            <select value={editStage} onChange={(e) => setEditStage(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg mb-3">
              {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Pipedrive Deal ID</label>
            <input type="text" value={editDealId} onChange={(e) => setEditDealId(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="e.g. 270494"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg mb-4" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditingCall(null)} className="px-4 py-2 text-sm font-semibold text-slate-500">Cancel</button>
              <button onClick={saveEdit} disabled={saving} className="px-4 py-2 text-sm font-semibold bg-asap-blue text-white rounded-lg disabled:opacity-50">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl border shadow-sm p-8 text-center text-slate-400 text-sm">Loading...</div>
      ) : calls.length === 0 ? (
        <div className="bg-white rounded-xl border shadow-sm p-8 text-center text-slate-400 text-sm">No calls yet.</div>
      ) : (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Qualifying</th>
                <th className="px-4 py-3">Stage</th>
                <th className="px-4 py-3">Deal</th>
                <th className="px-4 py-3">Revenue So Far</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {calls.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{fmtDate(c.call_start)}</td>
                  <td className="px-4 py-3 text-slate-600">{fmtDuration(c.duration_seconds)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${c.qualifying ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {c.qualifying ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{STAGES.find(s => s.key === (c.funnel_stage || 'transferred'))?.label || c.funnel_stage}</td>
                  <td className="px-4 py-3">
                    {c.pipedrive_deal_id ? (
                      <a href={`https://asapcreditrepair.pipedrive.com/deal/${c.pipedrive_deal_id}`} target="_blank" rel="noopener noreferrer" className="text-asap-blue hover:underline">
                        {c.pipedrive_deal_id}
                      </a>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.pipedrive_deal_id ? fmtMoney(revenueByDeal[c.pipedrive_deal_id] || 0) : '—'}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => openEdit(c)} className="text-slate-400 hover:text-asap-blue" title="Tag this call">
                      <Link2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
