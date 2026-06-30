import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';

const fmt = (n) => `$${(n || 0).toLocaleString()}`;

function StatCard({ label, value, sub, accent, onClick }) {
  return (
    <div onClick={onClick}
      className={`bg-white rounded-xl border border-slate-200 p-4 ${onClick ? 'cursor-pointer hover:border-indigo-300 hover:shadow-sm transition' : ''}`}>
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${accent || 'text-slate-900'}`}>{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

const DEAL_URL = (id) => `https://asapcreditrepair.pipedrive.com/deal/${id}`;

function DrillPanel({ drill, onClose }) {
  if (!drill) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-2xl sm:rounded-xl rounded-t-xl max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <div className="font-semibold text-slate-800">{drill.label} <span className="text-slate-400 font-normal">({drill.rows.length})</span></div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
        </div>
        <div className="overflow-y-auto divide-y divide-slate-100">
          {drill.rows.length === 0 && <div className="p-5 text-center text-slate-400 text-sm">Nothing here yet.</div>}
          {drill.rows.map((row, i) => (
            <div key={i} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-800 truncate">{row.title}</div>
                {row.sub && <div className="text-xs text-slate-500 truncate">{row.sub}</div>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {row.tag && <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{row.tag}</span>}
                {row.href && <a href={row.href} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline">Open</a>}
              </div>
            </div>
          ))}
        </div>
      </div>
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
  const [drill, setDrill] = useState(null);

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

  const TYPE_TAG = { idiq: 'IDIQ', smart: 'SmartCredit', other: 'Other' };
  const openReports = (label, filterFn) => {
    const rows = (c?.details?.reports || []).filter(filterFn).map((d) => ({
      title: d.title,
      sub: [d.site, d.reachedQuote ? 'quoted' : null, d.paidDocFee ? 'doc fee paid' : null].filter(Boolean).join(' · '),
      href: DEAL_URL(d.dealId),
      tag: TYPE_TAG[d.type] || 'Other'
    }));
    setDrill({ label, rows });
  };
  const openToday = (label, filterFn) => {
    const rows = (c?.details?.todayReports || []).filter(filterFn).map((d) => ({
      title: d.title,
      sub: d.site || '',
      href: DEAL_URL(d.dealId),
      tag: TYPE_TAG[d.type] || 'Other'
    }));
    setDrill({ label, rows });
  };
  const openMonthDeals = (label, filterFn) => {
    const rows = (c?.details?.monthDeals || []).filter(filterFn).map((d) => ({
      title: d.title,
      sub: [d.created ? `created ${String(d.created).slice(0, 10)}` : null, d.pipeline, d.stage, d.docFee ? 'doc fee collected' : null].filter(Boolean).join(' · '),
      href: DEAL_URL(d.dealId),
      tag: d.docFee ? 'Doc Fee' : ''
    }));
    setDrill({ label, rows });
  };
  const openStageDeals = (stageKey) => {
    const rows = (c?.details?.allDeals || []).filter((d) => d.stageKey === stageKey).map((d) => ({
      title: d.title,
      sub: [d.pipeline, d.stage].filter(Boolean).join(' · '),
      href: DEAL_URL(d.dealId),
      tag: ''
    }));
    setDrill({ label: stageKey, rows });
  };
  const openReviews = () => {
    const rows = (c?.details?.reviews || []).map((r) => ({
      title: r.reviewer,
      sub: [r.location, r.rating ? `${r.rating}★` : null, r.date].filter(Boolean).join(' · '),
      href: null,
      tag: r.bbb ? 'BBB' : ''
    }));
    setDrill({ label: 'Reviews', rows });
  };

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
                <th className="text-right font-medium px-4 py-2">Total Bonus</th>
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
                    <td className="px-4 py-2 text-right font-bold text-emerald-700">{fmt(r.totalBonus)}</td>
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
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">{myName} — {month}</h2>
            <div className="text-right">
              <div className="text-xs text-slate-500">Total Bonus</div>
              <div className="text-2xl font-bold text-emerald-600">{fmt(c.totalBonus)}</div>
            </div>
          </div>

          {c.today && (
            <div className="bg-gradient-to-r from-indigo-50 to-white rounded-xl border border-indigo-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold text-indigo-900">Today's Activity</div>
                <div className="text-xs text-indigo-500">{c.today.date}</div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <button onClick={() => openToday("Today's reports", () => true)} className="text-left bg-white rounded-lg border border-indigo-100 p-3 hover:border-indigo-300 transition">
                  <div className="text-2xl font-bold text-indigo-700">{c.today.total}</div>
                  <div className="text-xs text-slate-500">Reports pulled today</div>
                </button>
                <button onClick={() => openToday("Today's IDIQ", (d) => d.type === 'idiq')} className="text-left bg-white rounded-lg border border-indigo-100 p-3 hover:border-indigo-300 transition">
                  <div className="text-2xl font-bold text-slate-800">{c.today.idiq}</div>
                  <div className="text-xs text-slate-500">IDIQ today</div>
                </button>
                <button onClick={() => openToday("Today's SmartCredit", (d) => d.type === 'smart')} className="text-left bg-white rounded-lg border border-indigo-100 p-3 hover:border-indigo-300 transition">
                  <div className="text-2xl font-bold text-slate-800">{c.today.smartcredit}</div>
                  <div className="text-xs text-slate-500">SmartCredit today</div>
                </button>
                <div className="bg-white rounded-lg border border-indigo-100 p-3">
                  <div className="text-2xl font-bold text-emerald-600">{c.reviewBonus?.today ?? 0}</div>
                  <div className="text-xs text-slate-500">Reviews today</div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="IDIQ Reports" value={c.reports.idiq} sub="pays per report past #35" accent="text-indigo-600" onClick={() => openReports('IDIQ reports', (d) => d.type === 'idiq')} />
            <StatCard label="SmartCredit" value={c.reports.smartcredit} sub="counts toward 45" onClick={() => openReports('SmartCredit reports', (d) => d.type === 'smart')} />
            <StatCard label="Other" value={c.reports.other} sub="counts toward 45" onClick={() => openReports('Other reports', (d) => d.type === 'other')} />
            <StatCard label="Total Reports" value={c.reports.total} sub={c.reportBonus.qualified ? 'qualified (≥45)' : 'need 45 to qualify'} accent={c.reportBonus.qualified ? 'text-emerald-600' : 'text-amber-600'} onClick={() => openReports('All reports', () => true)} />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-slate-800">Report Bonus</div>
              <div className="text-2xl font-bold text-emerald-600">{fmt(c.reportBonus.bonus)}</div>
            </div>
            <div className="text-sm text-slate-500 mt-1">
              {c.reportBonus.qualified
                ? `${c.reportBonus.paidReports} paid IDIQ reports (past #35) × ${fmt(c.reportBonus.rate)} per report`
                : `Not qualified yet — needs 45 total reports this month`}
            </div>
            {(c.excluded.gatedOut + c.excluded.outOfMonth) > 0 && (
              <div className="text-xs text-slate-400 mt-3 border-t border-slate-100 pt-2">
                Not counted: {c.excluded.gatedOut} outside New Leads/Reports/Quoted 2.0 · {c.excluded.outOfMonth} dated outside this month
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className={`bg-white rounded-xl border p-4 ${c.conversionBonus?.qualified ? 'border-emerald-200' : 'border-slate-200'}`}>
              <div className="flex items-center justify-between">
                <div className="font-medium text-slate-700">Conversion Bonus</div>
                <div className={`font-bold ${c.conversionBonus?.qualified ? 'text-emerald-600' : 'text-slate-400'}`}>{fmt(c.conversionBonus?.bonus || 0)}</div>
              </div>
              <div className="text-xs text-slate-500 mt-2">
                Reports → Quote: <span className={c.conversionBonus?.rptsToQuoteRate >= 50 ? 'text-emerald-600 font-medium' : 'text-slate-600'}>{c.conversionBonus?.rptsToQuoteRate ?? 0}%</span> <span className="text-slate-400">(need 50%)</span>
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Quoted → Doc Fee: <span className={c.conversionBonus?.quoteToDocsRate >= 40 ? 'text-emerald-600 font-medium' : 'text-slate-600'}>{c.conversionBonus?.quoteToDocsRate ?? 0}%</span> <span className="text-slate-400">(need 40%)</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                <button onClick={() => openReports('Quoted', (d) => d.reachedQuote)} className="text-indigo-600 hover:underline">{c.conversionBonus?.reachedQuote ?? 0} quoted</button>
                <span> · </span>
                <button onClick={() => openReports('Paid doc fee', (d) => d.paidDocFee)} className="text-indigo-600 hover:underline">{c.conversionBonus?.reachedDocs ?? 0} paid doc fee</button>
              </div>
            </div>

            <div className={`bg-white rounded-xl border p-4 ${c.spotlight?.idiqTopConverter ? 'border-amber-300' : 'border-slate-200'}`}>
              <div className="flex items-center justify-between">
                <div className="font-medium text-slate-700">Spotlight</div>
                <div className={`font-bold ${c.spotlight?.bonus ? 'text-amber-600' : 'text-slate-400'}`}>{fmt(c.spotlight?.bonus || 0)}</div>
              </div>
              <div className="text-xs text-slate-500 mt-2">
                {c.spotlight?.idiqTopConverter ? '🏆 IDIQ Top Converter (+$50)' : `IDIQ Top Converter — ${c.idiqRate ?? 0}% IDIQ rate`}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {c.spotlight?.allStar
                  ? '⭐ All-Star CSR Winner (+$100)'
                  : c.spotlight?.inTheHunt
                    ? `🔥 In the hunt — current All-Star leader (score ${c.spotlight?.allStarScore ?? 0}/100, not final until month-end)`
                    : `All-Star CSR (+$100) — score ${c.spotlight?.allStarScore ?? 0}/100`}
              </div>
            </div>

            <div onClick={openReviews} className={`bg-white rounded-xl border p-4 cursor-pointer hover:border-indigo-300 transition ${c.reviewBonus?.bonus ? 'border-emerald-200' : 'border-slate-200'}`}>
              <div className="flex items-center justify-between">
                <div className="font-medium text-slate-700">Review Bonus</div>
                <div className={`font-bold ${c.reviewBonus?.bonus ? 'text-emerald-600' : 'text-slate-400'}`}>{fmt(c.reviewBonus?.bonus || 0)}</div>
              </div>
              <div className="text-xs text-slate-500 mt-2">
                {c.reviewBonus?.count ?? 0} reviews{(c.reviewBonus?.count ?? 0) > 10 ? ` (${c.reviewBonus.count - 10} past 10 × $5)` : ' (need 11+ to earn)'}
              </div>
              <div className="text-xs text-slate-500 mt-1">{c.reviewBonus?.bbb ?? 0} BBB review{(c.reviewBonus?.bbb ?? 0) === 1 ? '' : 's'} × $50</div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="font-medium text-slate-700">Base Pay</div>
            <div className="text-sm text-slate-500 mt-1">
              {fmt(c.basePay.amount)} this month{c.basePay.isMonth1 ? ' (Month 1 training rate)' : ''} · ongoing {fmt(c.basePay.ongoing)}/mo
            </div>
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

      <DrillPanel drill={drill} onClose={() => setDrill(null)} />
    </div>
  );
}
