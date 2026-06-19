import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';

const fmt = (n) => `$${(n || 0).toLocaleString()}`;

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${accent || 'text-slate-900'}`}>{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function CSRBonus() {
  const { currentUser } = useApp();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.department === 'leadership';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [month, setMonth] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
  });

  const load = async (m) => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/.netlify/functions/csr-bonus-metrics?month=${m}`);
      if (!res.ok) throw new Error('Failed to load CSR bonus data');
      const json = await res.json();
      setData(json);
      setSelected((prev) => prev || (isAdmin ? Object.keys(json.csrs || {})[0] : currentUser?.name));
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  useEffect(() => { load(month); }, [month]);

  if (loading) return <div className="p-6 text-center text-slate-500">Loading CSR bonuses…</div>;
  if (error) return <div className="p-6 text-center text-rose-600">{error}</div>;
  if (!data) return null;

  const names = Object.keys(data.csrs || {});
  const myName = isAdmin ? selected : currentUser?.name;
  const c = myName ? data.csrs[myName] : null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">CSR Bonuses</h1>
          <p className="text-sm text-slate-500">{data.payout}</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && names.length > 0 && (
            <select value={selected || ''} onChange={(e) => setSelected(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm">
              {names.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          )}
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
        </div>
      </div>

      {/* Admin leaderboard across all CSRs */}
      {isAdmin && names.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="text-left font-medium px-4 py-2">CSR</th>
                <th className="text-right font-medium px-4 py-2">IDIQ</th>
                <th className="text-right font-medium px-4 py-2">SmartCredit</th>
                <th className="text-right font-medium px-4 py-2">Total</th>
                <th className="text-right font-medium px-4 py-2">Qualified</th>
                <th className="text-right font-medium px-4 py-2">Report Bonus</th>
              </tr>
            </thead>
            <tbody>
              {names.map((n) => {
                const r = data.csrs[n];
                return (
                  <tr key={n} className={`border-t border-slate-100 cursor-pointer hover:bg-slate-50 ${n === selected ? 'bg-indigo-50' : ''}`}
                    onClick={() => setSelected(n)}>
                    <td className="px-4 py-2 font-medium text-slate-800">{n}</td>
                    <td className="px-4 py-2 text-right">{r.reports.idiq}</td>
                    <td className="px-4 py-2 text-right">{r.reports.smartcredit}</td>
                    <td className="px-4 py-2 text-right">{r.reports.total}</td>
                    <td className="px-4 py-2 text-right">{r.reportBonus.qualified ? '✓' : '—'}</td>
                    <td className="px-4 py-2 text-right font-semibold text-emerald-600">{fmt(r.reportBonus.bonus)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Selected CSR detail */}
      {c ? (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-800">{myName} — {month}</h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="IDIQ Reports" value={c.reports.idiq} sub="pays per report past #35" accent="text-indigo-600" />
            <StatCard label="SmartCredit" value={c.reports.smartcredit} sub="counts toward 50" />
            <StatCard label="Other" value={c.reports.other} sub="counts toward 50" />
            <StatCard label="Total Reports" value={c.reports.total} sub={c.reportBonus.qualified ? 'qualified (≥50)' : 'need 50 to qualify'} accent={c.reportBonus.qualified ? 'text-emerald-600' : 'text-amber-600'} />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-slate-800">Report Bonus</div>
              <div className="text-2xl font-bold text-emerald-600">{fmt(c.reportBonus.bonus)}</div>
            </div>
            <div className="text-sm text-slate-500 mt-1">
              {c.reportBonus.qualified
                ? `${c.reportBonus.paidReports} paid IDIQ reports (past #35) × ${fmt(c.reportBonus.rate)} per report`
                : `Not qualified yet — needs 50 total reports this month`}
            </div>
            {(c.excluded.noAccountManager + c.excluded.gatedOut + c.excluded.outOfMonth) > 0 && (
              <div className="text-xs text-slate-400 mt-3 border-t border-slate-100 pt-2">
                Not counted: {c.excluded.noAccountManager} no account manager · {c.excluded.gatedOut} outside New Leads/Reports/Quoted · {c.excluded.outOfMonth} dated outside this month
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-dashed border-slate-300 p-4">
              <div className="font-medium text-slate-700">Conversion Bonus</div>
              <div className="text-sm text-slate-400 mt-1">$50 — 50% reports→quote and 40% quoted→docs. Coming soon.</div>
            </div>
            <div className="bg-white rounded-xl border border-dashed border-slate-300 p-4">
              <div className="font-medium text-slate-700">Review Bonus</div>
              <div className="text-sm text-slate-400 mt-1">+$5 per review past 10, +$50 per public BBB review. Coming soon.</div>
            </div>
            <div className="bg-white rounded-xl border border-dashed border-slate-300 p-4">
              <div className="font-medium text-slate-700">Spotlight</div>
              <div className="text-sm text-slate-400 mt-1">IDIQ Top Converter +$50, All-Star CSR +$100. Coming soon.</div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="font-medium text-slate-700">Base Pay</div>
            <div className="text-sm text-slate-500 mt-1">Month 1 (training) {fmt(c.basePay.month1)} · Month 2 onward {fmt(c.basePay.ongoing)} per month</div>
          </div>

          {c.reports.total === 0 && (
            <div className="text-xs text-slate-400">
              Tracking starts fresh from today. Reports count as monitoring sites are set going forward, so this month fills in over time and next month is a full clean month.
            </div>
          )}
        </div>
      ) : (
        <div className="p-6 text-center text-slate-500">No bonus data found for {myName}.</div>
      )}
    </div>
  );
}
