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
  const SITE_OPTIONS = [
    ['486', 'Identity IQ'], ['3703', 'Identity Iq (Client Sent Reports)'], ['1715', 'Smart Credit'],
    ['3704', 'Smart Credit (Client Sent Reports)'], ['1744', 'Client sent credit reports to us'],
    ['1917', 'My Score IQ'], ['3571', 'CreditBuilder IQ'], ['3572', 'CreditScore IQ'],
    ['479', 'ProCredit'], ['480', 'Identity Guard'], ['481', 'Annual Credit Report'], ['482', 'Free Scores'],
    ['483', 'Privacy Guard'], ['484', 'ScoreSense'], ['485', 'Credit Check Total'], ['487', 'Idenity Force'],
    ['488', 'Freecreditscore.com'], ['561', 'Experian.com'], ['562', 'Transunion.com'], ['563', 'Equifax.com'],
    ['1150', 'MyFico.com'], ['1278', 'Free Score Connect'], ['1279', 'ID Lookout (Scoresense)'],
    ['1280', 'My Free Score Now'], ['1690', 'National Credit Report'], ['1867', 'Lender reports'],
    ['1914', 'Truly ID'], ['1928', 'ID Club'], ['1929', 'Credit Monitoring Solutions']
  ];
  const rowDealId = (row) => row.dealId || (row.href && (String(row.href).match(/deal\/(\d+)/) || [])[1]) || null;
  const fixSite = async (dealId, optionId, label) => {
    if (!window.confirm(`Set Monitoring Site to "${label}" for deal ${dealId}?\n\nThis updates Pipedrive (the source of truth) and the tracker.`)) return;
    try {
      const res = await fetch('/.netlify/functions/set-monitoring-site', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deal_id: dealId, option_id: optionId })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Save failed');
      window.alert(data.message || 'Saved. Counts update on the next metrics refresh.');
    } catch (e) { window.alert('Failed: ' + e.message); }
  };
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
                {rowDealId(row) && (
                  <select defaultValue="" onClick={(e) => e.stopPropagation()}
                    onChange={(e) => { const oid = e.target.value; if (!oid) return; const lbl = (SITE_OPTIONS.find(o => o[0] === oid) || [])[1]; fixSite(rowDealId(row), oid, lbl); e.target.value = ''; }}
                    className="text-[11px] border border-slate-200 rounded px-1 py-0.5 text-slate-500 bg-white max-w-[110px]">
                    <option value="">Fix site…</option>
                    {SITE_OPTIONS.map(([oid, lbl]) => <option key={oid} value={oid}>{lbl}</option>)}
                  </select>
                )}
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
  const [tab, setTab] = useState('team');       // team | me | bonuses (admins; non-admins always see their own view)
  const [range, setRange] = useState('today');  // today | yesterday | week | month | custom
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

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
  const openTodayDocFees = () => {
    const rows = (c?.details?.todayDocFees || []).map((d) => ({
      title: d.title,
      sub: d.site || '',
      href: DEAL_URL(d.dealId),
      tag: 'Doc Fee'
    }));
    setDrill({ label: "Today's doc fees", rows });
  };
  const openQuoteDeals = () => {
    const rows = (c?.details?.quoteDeals || []).map((d) => ({
      title: d.title,
      sub: d.site || '',
      href: DEAL_URL(d.dealId),
      tag: TYPE_TAG[d.type] || 'Other'
    }));
    setDrill({ label: 'Reports that reached Quote', rows });
  };
  const openDocsDeals = () => {
    const rows = (c?.details?.docsDeals || []).map((d) => ({
      title: d.title,
      sub: d.site || '',
      href: DEAL_URL(d.dealId),
      tag: 'Doc Fee'
    }));
    setDrill({ label: 'Reports that paid a Doc Fee', rows });
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

      {/* Tabs (leadership) */}
      {isAdmin && (
        <div className="flex items-center gap-1 border-b border-slate-200">
          {[['team', 'Team'], ['me', 'Individual'], ['bonuses', 'Bonuses']].map(([k, lbl]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg -mb-px border ${tab === k ? 'bg-white border-slate-200 border-b-white text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {lbl}
            </button>
          ))}
        </div>
      )}
      {/* TEAM: one date selector, four cards, one table */}
      {isAdmin && tab === 'team' && names.length > 0 && (() => {
        const ctToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date());
        const shift = (ds, n) => { const d = new Date(ds + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
        let b0 = ctToday, b1 = ctToday;
        if (range === 'yesterday') { b0 = shift(ctToday, -1); b1 = b0; }
        else if (range === 'week') { b0 = shift(ctToday, -6); }
        else if (range === 'month') { b0 = month + '-01'; b1 = month + '-31'; }
        else if (range === 'custom') { b0 = customStart || ctToday; b1 = customEnd || ctToday; }
        const inR = (d) => d && d >= b0 && d <= b1;
        const per = names.map((n) => {
          const r = data.csrs[n];
          const reps = (r.details?.reports || []).filter((d) => inR(d.date));
          const idiq = reps.filter((d) => d.type === 'idiq').length;
          const smart = reps.filter((d) => d.type === 'smart').length;
          const other = reps.length - idiq - smart;
          const quoted = reps.filter((d) => d.reachedQuote).length;
          const docs = (r.details?.docsDeals || []).filter((d) => inR(d.date)).length;
          const reviews = (r.details?.reviews || []).filter((d) => inR(d.date)).length;
          const rq = reps.length ? Math.round((quoted / reps.length) * 100) : 0;
          const qd = quoted ? Math.round((reps.filter((d) => d.paidDocFee).length / quoted) * 100) : 0;
          return { name: n, reports: reps.length, idiq, smart, other, docs, reviews, rq, qd };
        }).sort((a, b) => b.reports - a.reports || b.docs - a.docs);
        const teamRows = (kind, onlyName) => {
          const out = [];
          for (const n of (onlyName ? [onlyName] : names)) {
            const r = data.csrs[n];
            if (kind === 'reports') for (const d of (r.details?.reports || [])) { if (inR(d.date)) out.push({ title: d.title, sub: `${n} · ${d.site || ''}`, href: DEAL_URL(d.dealId), tag: TYPE_TAG[d.type] || 'Other' }); }
            if (kind === 'docs') for (const d of (r.details?.docsDeals || [])) { if (inR(d.date)) out.push({ title: d.title, sub: `${n} · ${d.site || ''}`, href: DEAL_URL(d.dealId), tag: 'Doc Fee' }); }
            if (kind === 'reviews') for (const d of (r.details?.reviews || [])) { if (inR(d.date)) out.push({ title: d.reviewer, sub: `${n} · ${d.location || ''}`, href: null, tag: d.bbb ? 'BBB' : '' }); }
          }
          if (kind === 'missing') {
            for (const n of (onlyName ? [onlyName] : names)) {
              const r = data.csrs[n];
              for (const d of (r.details?.missingSite || [])) out.push({ title: d.title, sub: `${n} - ${d.pipeline}${d.stage ? ' | ' + d.stage : ''}${d.created ? ' - created ' + d.created : ''}`, href: DEAL_URL(d.dealId), tag: 'No Site' });
            }
          }
          return out;
        };
        const openTeam = (label, kind, onlyName) => setDrill({ label, rows: teamRows(kind, onlyName) });
        const tot = per.reduce((a, x) => ({ reports: a.reports + x.reports, docs: a.docs + x.docs, reviews: a.reviews + x.reviews, idiq: a.idiq + x.idiq }), { reports: 0, docs: 0, reviews: 0, idiq: 0 });
        return (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {[['today', 'Today'], ['yesterday', 'Yesterday'], ['week', 'Last 7 days'], ['month', 'This month'], ['custom', 'Custom']].map(([k, lbl]) => (
                <button key={k} onClick={() => setRange(k)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full border ${range === k ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300 text-slate-600 hover:border-indigo-300'}`}>
                  {lbl}
                </button>
              ))}
              {range === 'custom' && (
                <span className="flex items-center gap-1 text-xs">
                  <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1 text-xs" />
                  <span className="text-slate-400">to</span>
                  <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1 text-xs" />
                </span>
              )}
              <span className="text-[11px] text-slate-400 ml-auto">within {month}</span>
            </div>
            {(() => { const missN = names.reduce((a, n) => a + ((data.csrs[n]?.reports?.missingSite) || 0), 0); return missN > 0 ? (
              <div onClick={() => openTeam('Clients missing a credit monitoring site', 'missing')}
                className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-sm text-rose-700 cursor-pointer hover:border-rose-400 transition font-medium">
                {'\u26A0\uFE0F'} {missN} client{missN === 1 ? '' : 's'} in early pipelines with no credit monitoring site set - click to view and update
              </div>
            ) : null; })()}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Reports" value={tot.reports} sub={`${tot.idiq} IDIQ · click for list`} accent="text-indigo-600" onClick={() => openTeam('Reports (' + b0 + ' to ' + b1 + ')', 'reports')} />
              <StatCard label="Doc fees" value={tot.docs} accent="text-emerald-600" onClick={() => openTeam('Doc fees (' + b0 + ' to ' + b1 + ')', 'docs')} />
              <StatCard label="Reviews" value={tot.reviews} onClick={() => openTeam('Reviews (' + b0 + ' to ' + b1 + ')', 'reviews')} />
              <StatCard label="Conversion" value={tot.reports ? Math.round((tot.docs / tot.reports) * 100) + '%' : '0%'} sub="doc fees / reports" />
            </div>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="text-left font-medium px-4 py-2">CSR</th>
                    <th className="text-right font-medium px-4 py-2" title="Deals where a credit monitoring site was set in this period. A deal only counts as a report once its Monitoring Site field is filled in Pipedrive.">Reports</th>
                    <th className="text-right font-medium px-4 py-2" title="Report deals whose doc fee was PAID (confirmed in payment records) in this period.">Doc fees</th>
                    <th className="text-right font-medium px-4 py-2" title="Client reviews assigned to this CSR, credited to the month the review was left. Standard: 10/month. Pay: $5 each past 10, plus $50 per BBB review.">Reviews</th>
                    <th className="text-right font-medium px-4 py-2" title="Reports to Quote: % of this period's report deals that moved into Quoted 2.0 or beyond. Target: 50%. Feeds the $50 conversion bonus.">R→Q</th>
                    <th className="text-right font-medium px-4 py-2" title="Quote to Doc Fee: % of quoted report deals that paid a doc fee. Target: 40%. Feeds the $50 conversion bonus.">Q→Doc</th>
                  </tr>
                </thead>
                <tbody>
                  {per.map((x) => (
                    <tr key={'tm-' + x.name} className="border-t border-slate-100 cursor-pointer hover:bg-slate-50"
                      onClick={() => { setSelected(x.name); setTab('me'); }}>
                      <td className="px-4 py-2 font-medium text-slate-800">{x.name}</td>
                      <td className="px-4 py-2 text-right cursor-pointer hover:bg-indigo-50" onClick={(e) => { e.stopPropagation(); if (x.reports > 0) openTeam(x.name + ' - reports', 'reports', x.name); }}>
                        <span className={`font-semibold ${x.reports > 0 ? 'text-indigo-700' : 'text-slate-300'}`}>{x.reports}</span>
                        {x.reports > 0 && <span className="text-[10px] text-slate-400 ml-1.5">{x.idiq} IDIQ · {x.smart} SC · {x.other} Other</span>}
                      </td>
                      <td className={`px-4 py-2 text-right cursor-pointer hover:bg-emerald-50 ${x.docs > 0 ? 'text-emerald-600 font-semibold' : 'text-slate-300'}`} onClick={(e) => { e.stopPropagation(); if (x.docs > 0) openTeam(x.name + ' - doc fees', 'docs', x.name); }}>{x.docs}</td>
                      <td className={`px-4 py-2 text-right cursor-pointer hover:bg-slate-100 ${x.reviews > 0 ? '' : 'text-slate-300'}`} onClick={(e) => { e.stopPropagation(); if (x.reviews > 0) openTeam(x.name + ' - reviews', 'reviews', x.name); }}>{x.reviews}</td>
                      <td className={`px-4 py-2 text-right text-xs ${x.rq >= 50 ? 'text-emerald-600 font-semibold' : 'text-slate-500'}`}>{x.rq}%</td>
                      <td className={`px-4 py-2 text-right text-xs ${x.qd >= 40 ? 'text-emerald-600 font-semibold' : 'text-slate-500'}`}>{x.qd}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}
      {/* Admin leaderboard across all CSRs */}
      {isAdmin && tab === 'bonuses' && names.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="text-left font-medium px-4 py-2">CSR</th>
                <th className="text-right font-medium px-4 py-2" title="IDIQ reports pulled. ONLY IDIQ pays, and the rate is set by your IDIQ count: first 35 unpaid, then every paid report earns $3 (35-65 IDIQ), $5 (66-80 IDIQ), or $7 (81+ IDIQ). Example: 70 IDIQ = 35 paid x $5 = $175.">IDIQ</th>
                <th className="text-right font-medium px-4 py-2" title="SmartCredit reports. These count toward the 50-report qualifier but are not paid per report.">SmartCredit</th>
                <th className="text-right font-medium px-4 py-2" title="Reports on any other monitoring site. Count toward the 50-report qualifier but are not paid per report.">Other</th>
                <th className="text-right font-medium px-4 py-2" title="All reports this month (IDIQ + SmartCredit + Other). You must reach 50 TOTAL reports to be eligible for the report bonus at all.">Total</th>
                <th className="text-right font-medium px-4 py-2" title="Whether the 50-total-report qualifier is met this month. Below 50 total = no report bonus regardless of IDIQ count.">Qualified</th>
                <th className="text-right font-medium px-4 py-2" title="IDIQ reports past the first 35, all paid at the single rate your IDIQ count reaches: $3 (35-65), $5 (66-80), $7 (81+). Requires 50 total reports to qualify.">Report Bonus</th>
                <th className="text-right font-medium px-4 py-2" title="Report bonus + conversion bonus ($50) + review bonus ($5/review past 10, $50/BBB) + All-Star ($100).">Total Bonus</th>
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
                    <td className="px-4 py-2 text-right">{r.reports.other}</td>
                    <td className="px-4 py-2 text-right">{r.reports.total}</td>
                    <td className="px-4 py-2 text-right">{r.reportBonus.qualified ? '✓' : '—'}</td>
                    <td className="px-4 py-2 text-right font-semibold text-emerald-600">{fmt(r.reportBonus.bonus)}</td>
                    <td className="px-4 py-2 text-right font-bold text-emerald-700">{fmt(r.totalBonus)}</td>
                  </tr>
                );
              })}
              {Object.entries(data.ownerBasedReports || {}).map(([owner, o]) => (
                <tr key={'owner-' + owner} className="border-t border-slate-100 bg-amber-50/40">
                  <td className="px-4 py-2 text-slate-600">{owner} <span className="ml-1 text-[10px] uppercase tracking-wide text-amber-600 font-semibold">owner-based (no rep)</span></td>
                  <td className="px-4 py-2 text-right">{o.idiq}</td>
                  <td className="px-4 py-2 text-right">{o.smart}</td>
                  <td className="px-4 py-2 text-right">{o.other ?? ((o.total||0)-(o.idiq||0)-(o.smart||0))}</td>
                  <td className="px-4 py-2 text-right">{o.total}</td>
                  <td className="px-4 py-2 text-right text-slate-300">—</td>
                  <td className="px-4 py-2 text-right text-slate-300">tracking only</td>
                  <td className="px-4 py-2 text-right text-slate-300">—</td>
                </tr>
              ))}
            </tbody>
          </table>
          {Object.keys(data.ownerBasedReports || {}).length > 0 && (
            <p className="px-4 py-2 text-xs text-slate-500 bg-amber-50/40 border-t border-slate-100">Owner-based rows are reports with no Call Center Rep, attributed to the deal owner for tracking only. They do not earn a bonus.</p>
          )}
        </div>
      )}

      {/* Selected CSR detail */}
      {(!isAdmin || tab === 'me') && c ? (
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
                <button onClick={() => openTodayDocFees()} className="text-left bg-white rounded-lg border border-indigo-100 p-3 hover:border-indigo-300 transition">
                  <div className="text-2xl font-bold text-emerald-600">{c.today.docFees ?? 0}</div>
                  <div className="text-xs text-slate-500">Doc fees today</div>
                </button>
                <div className="bg-white rounded-lg border border-indigo-100 p-3">
                  <div className="text-2xl font-bold text-emerald-600">{c.reviewBonus?.today ?? 0}</div>
                  <div className="text-xs text-slate-500">Reviews today</div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-indigo-100 grid grid-cols-2 gap-3">
                <button onClick={openQuoteDeals} className="text-left bg-white rounded-lg border border-slate-100 p-3 hover:border-indigo-300 transition">
                  <div className="text-xs text-slate-400 mb-1">Reports → Quote (MTD)</div>
                  <div className="text-lg font-bold text-slate-800">{c.conversionBonus?.rptsToQuoteRate ?? 0}%</div>
                  <div className="text-xs text-indigo-500 underline decoration-dotted">{c.conversionBonus?.reachedQuote ?? 0} of {c.conversionBonus?.convTotal ?? c.reports?.total ?? 0} quoted</div>
                </button>
                <button onClick={openDocsDeals} className="text-left bg-white rounded-lg border border-slate-100 p-3 hover:border-indigo-300 transition">
                  <div className="text-xs text-slate-400 mb-1">Quote → Docs (MTD)</div>
                  <div className="text-lg font-bold text-slate-800">{c.conversionBonus?.quoteToDocsRate ?? 0}%</div>
                  <div className="text-xs text-indigo-500 underline decoration-dotted">{c.conversionBonus?.reachedDocs ?? 0} paid doc fee</div>
                </button>
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

          {(c.details?.missingSite || []).length > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
              <div className="font-medium text-rose-700 mb-1">{'\u26A0\uFE0F'} {c.details.missingSite.length} of your clients have no credit monitoring site</div>
              <div className="text-xs text-rose-600 mb-2">These deals cannot count as reports until Monitoring Site (1) is set on the Pipedrive deal. Click a client to open the deal and update it.</div>
              <div className="space-y-1">
                {c.details.missingSite.map((d) => (
                  <a key={d.dealId} href={DEAL_URL(d.dealId)} target="_blank" rel="noreferrer" className="block text-sm text-slate-700 hover:text-indigo-600">
                    {d.title} <span className="text-xs text-slate-400">{d.pipeline}{d.stage ? ' | ' + d.stage : ''}{d.created ? ' - created ' + d.created : ''}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
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
