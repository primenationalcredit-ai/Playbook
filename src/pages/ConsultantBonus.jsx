import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Trophy, TrendingUp, DollarSign, Users, Star, Award, Target,
  RefreshCw, AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Zap, Gift,
  Shield, Clock, X, Eye
} from 'lucide-react';

const fmt = (n) => '$' + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (n) => '$' + Math.round(n || 0).toLocaleString();
const fmtDate = (d) => {
  if (!d) return '';
  const parts = d.split('-');
  if (parts.length === 3) return `${parts[1]}-${parts[2]}-${parts[0].slice(2)}`;
  return d;
};
const DEAL_URL = (id) => `https://asapcreditrepair.pipedrive.com/deal/${id}`;

// Slide-out panel for client details
function ClientPanel({ title, items, columns, onClose, payments }) {
  if (!items) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative w-full max-w-lg bg-white shadow-2xl h-full overflow-y-auto animate-slide-in" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b px-5 py-4 flex justify-between items-center z-10">
          <div>
            <h3 className="font-bold text-lg text-slate-800">{title}</h3>
            <p className="text-sm text-slate-500">{items.length} record{items.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-3">
          {items.length === 0 ? <p className="text-slate-400 text-center py-8">No records</p> :
            items.map((item, i) => (
              <div key={i} className={`bg-slate-50 rounded-lg p-3 border ${item.onClick ? 'hover:border-blue-300 cursor-pointer' : 'hover:border-blue-200'}`} onClick={item.onClick || undefined}>
                <div className="flex justify-between items-start mb-1">
                  {item.dealId ? (
                    <a href={DEAL_URL(item.dealId)} target="_blank" rel="noreferrer" className="font-medium text-blue-600 hover:underline">{item.name} ↗</a>
                  ) : (
                    <p className="font-medium text-slate-800">{item.name}</p>
                  )}
                  {item.amount !== undefined && <p className="font-bold text-green-600">{fmt(item.amount)}</p>}
                  {item.totalPaid !== undefined && <p className="font-bold text-green-600">{fmt(item.totalPaid)}</p>}
                </div>
                {item.org && <p className="text-xs text-blue-600 mb-1">Affiliate: {item.org}</p>}
                {item.type && <span className={`text-xs px-2 py-0.5 rounded-full ${
                  item.type === 'doc_fee' ? 'bg-amber-100 text-amber-700' :
                  item.type === 'partial' ? 'bg-purple-100 text-purple-700' :
                  item.type === 'final' ? 'bg-green-100 text-green-700' :
                  item.type === 'no_doc' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
                }`}>{item.type === 'doc_fee' ? 'Doc Fee' : item.type === 'partial' ? 'Partial' : item.type === 'final' ? 'Final' : item.type === 'no_doc' ? 'No Doc Fee' : item.type}</span>}
                {item.date && <span className="text-xs text-slate-400 ml-2">{fmtDate(item.date)}</span>}
                {item.reason && (
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">Not Qualified</span>
                    <span className="text-xs text-slate-500">{item.reason}</span>
                  </div>
                )}
                {/* Payment journey for qualified docs */}
                {item.payments && item.payments.length > 0 && (
                  <div className="mt-2 border-t pt-2">
                    <p className="text-xs font-medium text-slate-500 mb-1">Payment Journey:</p>
                    <div className="flex gap-1 flex-wrap">
                      {item.payments.map((p, pi) => (
                        <div key={pi} className={`text-xs px-2 py-1 rounded ${
                          p.type === 'doc_fee' ? 'bg-amber-100 text-amber-700' :
                          p.type === 'partial' ? 'bg-purple-100 text-purple-700' :
                          p.type === 'final' ? 'bg-green-100 text-green-700' : 'bg-slate-100'
                        }`}>
                          {p.type === 'doc_fee' ? '📄 Doc' : p.type === 'partial' ? '💰 Partial' : p.type === 'final' ? '✅ Final' : p.type} {fmt(p.amount)} • {fmtDate(p.date)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {item.onClick && <p className="text-xs text-blue-600 mt-2">View {item.clientCount != null ? item.clientCount : ''} client{item.clientCount === 1 ? '' : 's'} →</p>}
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}

// Tooltip - shows instantly on hover, tap on mobile
function Tip({ text, children }) {
  const [show, setShow] = React.useState(false);
  const [pos, setPos] = React.useState({ top: 0, left: 0 });
  const ref = React.useRef(null);
  const place = () => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ top: r.top, left: r.left + r.width / 2 });
  };
  return (
    <span ref={ref} className="relative inline-flex items-center gap-1"
      onMouseEnter={() => { place(); setShow(true); }} onMouseLeave={() => setShow(false)}
      onClick={(e) => { e.stopPropagation(); place(); setShow(!show); }}>
      <span className="border-b border-dotted border-slate-400 cursor-help">{children}</span>
      {show && (
        <span className="fixed px-3 py-2 bg-slate-900 text-white text-xs rounded-lg shadow-xl z-[200] leading-relaxed"
          style={{ top: pos.top - 8, left: pos.left, transform: 'translate(-50%, -100%)', minWidth: '200px', maxWidth: '300px', whiteSpace: 'normal', pointerEvents: 'none' }}>
          {text}
        </span>
      )}
    </span>
  );
}

function DrillButton({ onClick, label }) {
  return <button onClick={onClick} className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1 mt-1"><Eye size={12} /> {label || 'View clients'}</button>;
}

export default function ConsultantBonus() {
  const { currentUser, users } = useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedConsultant, setSelectedConsultant] = useState(null);
  const [tab, setTab] = useState('bonuses');
  const [expandedSection, setExpandedSection] = useState(null);
  const [sprintWeek, setSprintWeek] = useState(null);
  const [lbTab, setLbTab] = useState('overview');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const isAdmin = currentUser?.role === 'admin' || currentUser?.department === 'leadership';

  const loadData = async (month) => {
    setLoading(true);
    try {
      const m = month || selectedMonth;
      const res = await fetch(`/.netlify/functions/consultant-bonus-metrics?month=${m}`);
      if (!res.ok) throw new Error('Failed to load bonus data');
      const json = await res.json();
      setData(json);
      if (!selectedConsultant) {
        if (isAdmin) {
          const names = Object.keys(json.consultants);
          if (names.length > 0) setSelectedConsultant(names[0]);
        } else {
          setSelectedConsultant(currentUser?.name);
        }
      }
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetch('/.netlify/functions/zoho-payment-sync');
      await fetch('/.netlify/functions/payment-enrich');
      await loadData();
    } catch (e) {}
    setSyncing(false);
  };

  const exportReport = () => {
    if (!data) return;
    const cons = Object.values(data.consultants);
    const html = `<!DOCTYPE html><html><head><title>Bonus Report - ${data.month}</title>
    <style>body{font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:20px;color:#333}
    h1{font-size:22px;border-bottom:2px solid #333;padding-bottom:8px}
    h2{font-size:16px;margin-top:24px;color:#555}
    table{width:100%;border-collapse:collapse;margin:8px 0 16px}
    th,td{border:1px solid #ddd;padding:6px 10px;text-size:12px;text-align:left}
    th{background:#f5f5f5;font-weight:600}
    .right{text-align:right}.bold{font-weight:700}
    .total-row{background:#f0fdf4;font-weight:700}
    @media print{body{padding:0}}</style></head><body>
    <h1>ASAP Credit & Financial Services — Consultant Bonus Report</h1>
    <p><strong>Period:</strong> ${data.month} | <strong>Generated:</strong> ${new Date().toLocaleDateString()}</p>
    ${cons.map(c => `
    <h2>${c.name}</h2>
    <table>
      <tr><th>Metric</th><th class="right">Value</th><th class="right">Amount</th></tr>
      <tr><td>Total Sales (MTD)</td><td class="right">${c.totalSales?.toLocaleString('en-US',{style:'currency',currency:'USD'})}</td><td></td></tr>
      <tr><td>Organic Sales (${c.baseRate})</td><td class="right">${c.organicSales?.toLocaleString('en-US',{style:'currency',currency:'USD'})}</td><td class="right">${c.baseCommission?.toLocaleString('en-US',{style:'currency',currency:'USD'})}</td></tr>
      <tr><td>Affiliate Sales (${c.affiliateRate})</td><td class="right">${c.affiliateSales?.toLocaleString('en-US',{style:'currency',currency:'USD'})}</td><td class="right">${c.affiliateCommission?.toLocaleString('en-US',{style:'currency',currency:'USD'})}</td></tr>
      <tr class="total-row"><td>Total Commission</td><td></td><td class="right">${c.totalCommission?.toLocaleString('en-US',{style:'currency',currency:'USD'})}</td></tr>
      <tr><td colspan="3" style="background:#eee;font-weight:600">Bonuses</td></tr>
      <tr><td>Doc Production Accelerator (${c.qualifiedDocs} qualified)</td><td class="right">${c.qualifiedDocs}</td><td class="right">${c.accelerator?.total?.toLocaleString('en-US',{style:'currency',currency:'USD'})}</td></tr>
      <tr><td>Doc Club Milestone</td><td class="right">${c.docClub || 'Not reached'}</td><td class="right">${c.docClubBonus?.toLocaleString('en-US',{style:'currency',currency:'USD'})}</td></tr>
      <tr><td>PIF Fast Start (${c.pifCount} clients)</td><td class="right">${c.pifCount}</td><td class="right">${c.pifBonus?.toLocaleString('en-US',{style:'currency',currency:'USD'})}</td></tr>
      <tr><td>Active Affiliate Bonus (${c.producingAffiliates} affiliates)</td><td class="right">${c.producingAffiliates}</td><td class="right">${c.affiliateBonus?.toLocaleString('en-US',{style:'currency',currency:'USD'})}</td></tr>
      <tr><td>Client Reviews (${c.reviewCount})</td><td class="right">${c.reviewCount}</td><td class="right">${c.reviewBonus?.toLocaleString('en-US',{style:'currency',currency:'USD'})}</td></tr>
      <tr><td>Weekly Sprint (${c.weeksWon||0} weeks won)</td><td class="right">${c.weeksWon||0}</td><td class="right">${c.sprintBonus?.toLocaleString('en-US',{style:'currency',currency:'USD'})}</td></tr>
      <tr><td>Reactivation Kicker</td><td class="right">${c.reactivationCount||0}</td><td class="right">${c.reactivationBonus?.toLocaleString('en-US',{style:'currency',currency:'USD'})}</td></tr>
      <tr><td>New Affiliate Launch</td><td class="right">${c.newAffiliateLaunchCount||0}</td><td class="right">${c.newAffiliateLaunchBonus?.toLocaleString('en-US',{style:'currency',currency:'USD'})}</td></tr>
      <tr class="total-row"><td>Total Bonuses</td><td></td><td class="right">${c.totalBonus?.toLocaleString('en-US',{style:'currency',currency:'USD'})}</td></tr>
      <tr class="total-row" style="background:#dcfce7"><td class="bold">TOTAL EARNINGS</td><td></td><td class="right bold">${c.totalEarnings?.toLocaleString('en-US',{style:'currency',currency:'USD'})}</td></tr>
      <tr><td colspan="3" style="background:#eee;font-weight:600">Standards</td></tr>
      <tr><td>Closing %</td><td class="right">${c.closingPct}% (${c.meetsClosingStandard ? 'PASS' : 'FAIL'})</td><td></td></tr>
      <tr><td>Pay-Past-Doc %</td><td class="right">${c.payPastDocRate}% (${c.meetsPayPastDocStandard ? 'PASS' : 'FAIL'})</td><td></td></tr>
      <tr><td>Reviews</td><td class="right">${c.reviewCount} (${c.meetsReviewStandard ? 'PASS' : 'FAIL'})</td><td></td></tr>
    </table>`).join('')}
    </body></html>`;
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    w.print();
  };

  useEffect(() => { loadData(); }, [selectedMonth]);

  if (loading) return (
    <div className="p-6 flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-3" />
        <p className="text-slate-500">Loading bonus data from Pipedrive...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="p-6"><div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
      <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-3" />
      <p className="font-medium text-red-800">{error}</p>
      <button onClick={loadData} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg">Retry</button>
    </div></div>
  );

  if (!data) return null;

  const c = data.consultants[selectedConsultant];
  if (!c) return <div className="p-6 text-center text-slate-500">No data found for {selectedConsultant}</div>;

  const docsToNext = c.qualifiedDocs < 50 ? 50 - c.qualifiedDocs :
    c.qualifiedDocs < 60 ? 60 - c.qualifiedDocs :
    c.qualifiedDocs < 70 ? 70 - c.qualifiedDocs :
    c.qualifiedDocs < 75 ? 75 - c.qualifiedDocs :
    c.qualifiedDocs < 80 ? 80 - c.qualifiedDocs :
    c.qualifiedDocs < 90 ? 90 - c.qualifiedDocs : 0;
  const nextTierLabel = c.qualifiedDocs < 50 ? 'Accelerator unlocks at 51' :
    c.qualifiedDocs < 60 ? '$20/doc tier at 61' :
    c.qualifiedDocs < 70 ? '$30/doc tier at 71' :
    c.qualifiedDocs < 75 ? '75 Doc Club ($200)' :
    c.qualifiedDocs < 80 ? '$45/doc tier at 81' :
    c.qualifiedDocs < 90 ? '90 Doc Club ($350)' : 'Max tier reached!';

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
            <Trophy className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Bonus Tracker</h1>
            <p className="text-slate-500 text-sm">{data.month} • {data.totalPayments} payments from Zoho</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="month" value={selectedMonth} onChange={e => { setSelectedMonth(e.target.value); setExpandedSection(null); }}
            className="px-3 py-1.5 border rounded-lg text-sm text-slate-700 bg-white" />
          {isAdmin && (
            <select value={selectedConsultant || ''} onChange={(e) => setSelectedConsultant(e.target.value)}
              className="px-3 py-1.5 border rounded-lg text-sm font-medium">
              {Object.keys(data.consultants).map(name => (
                <option key={name} value={name}>{name} {data.consultants[name].isVA ? '(VA)' : ''}</option>
              ))}
            </select>
          )}
          {isAdmin && (
            <button onClick={handleSync} disabled={syncing}
              className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Syncing...' : 'Sync Now'}
            </button>
          )}
          {isAdmin && (
            <button onClick={exportReport}
              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">
              Export PDF
            </button>
          )}
          <button onClick={() => loadData()} className="p-1.5 bg-slate-100 rounded-lg hover:bg-slate-200"><RefreshCw size={16} /></button>
        </div>
      </div>

      {/* Total Earnings Banner */}
      <div className="bg-gradient-to-r from-emerald-600 to-green-700 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-emerald-200 text-sm">Projected Total Earnings — {data.month}</p>
            <p className="text-4xl font-bold mt-1">{fmt(c.totalEarnings)}</p>
            <p className="text-emerald-200 text-sm mt-2">Commission: {fmt(c.totalCommission)} + Bonuses: {fmt(c.totalBonus)}</p>
          </div>
          <div className="text-right">
            <p className="text-emerald-200 text-sm">{c.isVA ? 'VA' : 'In-House'}</p>
            <p className="text-lg font-semibold">{c.baseRate} / {c.affiliateRate}</p>
            <p className="text-emerald-200 text-xs">Google / Affiliate rates</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 rounded-lg p-1 w-fit">
        <button onClick={() => setTab('bonuses')} className={`px-5 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${tab === 'bonuses' ? 'bg-white shadow text-slate-800' : 'text-slate-600'}`}>
          <Trophy size={16} /> My Bonuses
        </button>
        <button onClick={() => setTab('leaderboard')} className={`px-5 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${tab === 'leaderboard' ? 'bg-white shadow text-slate-800' : 'text-slate-600'}`}>
          <Award size={16} /> Leaderboard
        </button>
      </div>

      {tab === 'leaderboard' && (() => {
        const cons = Object.values(data.consultants).sort((a, b) => b.totalSales - a.totalSales);
        const Cell = ({v, good, bad}) => <td className={`text-center px-3 py-2.5 ${good ? 'text-green-600 font-medium' : bad ? 'text-red-500' : ''}`}>{v}</td>;
        const t = data.teamTotals || {};
        const LbTab = ({id, label}) => <button onClick={() => setLbTab(id)} className={`px-4 py-1.5 rounded-md text-xs font-medium ${lbTab === id ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>{label}</button>;
        return (<div className="space-y-4">

        {/* Team Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div className="bg-white rounded-xl border shadow-sm p-4">
            <p className="text-xs text-slate-500 mb-1">Today</p>
            <p className="text-2xl font-bold text-green-600">{fmtInt(t.todaySales||0)}</p>
            <div className="flex gap-2 mt-1 text-xs text-slate-400">
              <span>{t.todayDocs||0} docs</span><span>{t.todayPartials||0} par</span><span>{t.todayFinals||0} fin</span>
            </div>
          </div>
          <div className="bg-white rounded-xl border shadow-sm p-4">
            <p className="text-xs text-slate-500 mb-1">MTD Sales</p>
            <p className="text-2xl font-bold text-slate-800">{fmtInt(t.mtdSales||0)}</p>
            <p className="text-xs text-slate-400 mt-1">{t.totalPayments||0} payments</p>
          </div>
          <div className="bg-white rounded-xl border shadow-sm p-4">
            <p className="text-xs text-slate-500 mb-1">Projection</p>
            <p className="text-2xl font-bold text-blue-600">{fmtInt(t.mtdProjection||0)}</p>
            <p className="text-xs text-slate-400 mt-1">Based on daily pace</p>
          </div>
          <div className="bg-white rounded-xl border shadow-sm p-4">
            <p className="text-xs text-slate-500 mb-1">YTD Sales</p>
            <p className="text-2xl font-bold text-indigo-600">{fmtInt(t.ytdSales||0)}</p>
            <p className="text-xs text-slate-400 mt-1">{t.ytdDocs||0} total docs</p>
          </div>
          <div className="bg-white rounded-xl border shadow-sm p-4">
            <p className="text-xs text-slate-500 mb-1">MTD Breakdown</p>
            <div className="flex gap-2 mt-1">
              <div className="text-center"><p className="text-lg font-bold text-amber-600">{t.mtdDocs||0}</p><p className="text-xs text-slate-400">Docs</p></div>
              <div className="text-center"><p className="text-lg font-bold text-purple-600">{t.mtdPartials||0}</p><p className="text-xs text-slate-400">Par</p></div>
              <div className="text-center"><p className="text-lg font-bold text-green-600">{t.mtdFinals||0}</p><p className="text-xs text-slate-400">Fin</p></div>
            </div>
          </div>
          <div className={`bg-white rounded-xl border shadow-sm p-4 ${(t.totalOverdue||0) > 0 ? 'border-red-200' : ''}`}>
            <p className="text-xs text-slate-500 mb-1">Overdue</p>
            <p className={`text-2xl font-bold ${(t.totalOverdue||0) > 0 ? 'text-red-600' : 'text-green-600'}`}>{t.totalOverdue||0}</p>
            <p className="text-xs text-slate-400 mt-1">{fmtInt(t.totalOverdueAmount||0)} outstanding</p>
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="bg-slate-100 rounded-lg p-1 flex gap-1 flex-wrap">
          <LbTab id="overview" label="Overview" />
          <LbTab id="sales" label="Sales" />
          <LbTab id="production" label="Production" />
          <LbTab id="payments" label="Payments" />
          <LbTab id="quality" label="Quality" />
          <LbTab id="sprint" label="Sprint" />
        </div>

        {/* OVERVIEW */}
        {lbTab === 'overview' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="p-4 border-b"><h3 className="font-bold text-slate-800">Rankings</h3></div>
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead className="bg-slate-50"><tr>
                <th className="text-left px-3 py-2">#</th><th className="text-left px-3 py-2">Consultant</th>
                <th className="text-center px-3 py-2"><Tip text="Payments received today">Today</Tip></th>
                <th className="text-center px-3 py-2"><Tip text="Total payments this month">MTD</Tip></th>
                <th className="text-center px-3 py-2"><Tip text="Year to date total">YTD</Tip></th>
                <th className="text-center px-3 py-2"><Tip text="Doc fees / consults">Close %</Tip></th>
                <th className="text-center px-3 py-2"><Tip text="New clients onboarded this month">Onboarded</Tip></th>
                <th className="text-center px-3 py-2"><Tip text="Clients without final payment 30+ days">Pending 30d</Tip></th>
              </tr></thead>
              <tbody className="divide-y">
                {cons.map((c, i) => (
                  <tr key={c.name} className="hover:bg-slate-50 cursor-pointer" onClick={() => { setSelectedConsultant(c.name); setTab('bonuses'); }}>
                    <td className="px-3 py-2.5">{i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</td>
                    <td className="px-3 py-2.5 font-medium">{c.name} {(c.weeksWon||0)>0 && <span className="text-xs bg-orange-100 text-orange-700 px-1 rounded">{c.weeksWon}x Sprint</span>}</td>
                    <Cell v={fmtInt(c.today?.sales||0)} good={(c.today?.sales||0)>0} />
                    <Cell v={fmtInt(c.totalSales)} />
                    <Cell v={fmtInt(c.ytd?.sales||0)} />
                    <Cell v={(c.closingPct||0)+'%'} good={c.meetsClosingStandard} bad={!c.meetsClosingStandard} />
                    <Cell v={c.onboardedClients||0} />
                    <Cell v={c.pendingCount30||0} bad={(c.pendingCount30||0)>3} />
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>

          {/* Today Breakdown */}
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="p-4 border-b"><h3 className="font-bold text-slate-800">Today's Activity</h3></div>
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead className="bg-slate-50"><tr>
                <th className="text-left px-3 py-2">Consultant</th>
                <th className="text-center px-3 py-2">Sales</th><th className="text-center px-3 py-2">Docs</th>
                <th className="text-center px-3 py-2">Partials</th><th className="text-center px-3 py-2">Finals</th>
                <th className="text-center px-3 py-2">Payments</th>
              </tr></thead>
              <tbody className="divide-y">{cons.map(c => (
                <tr key={c.name} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-medium">{c.name.split(' ')[0]}</td>
                  <Cell v={fmtInt(c.today?.sales||0)} good={(c.today?.sales||0)>0} />
                  <Cell v={c.today?.docs||0} good={(c.today?.docs||0)>0} />
                  <Cell v={c.today?.partials||0} /><Cell v={c.today?.finals||0} />
                  <Cell v={c.today?.payments||0} />
                </tr>
              ))}</tbody>
            </table></div>
          </div>
        </div>
        )}

        {/* SALES */}
        {lbTab === 'sales' && (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="p-4 border-b"><h3 className="font-bold text-slate-800">Sales Performance — MTD vs YTD</h3></div>
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="bg-slate-50"><tr>
              <th className="text-left px-3 py-2">Consultant</th>
              <th className="text-center px-3 py-2 bg-blue-50"><Tip text="Total sales this month">MTD Sales</Tip></th>
              <th className="text-center px-3 py-2 bg-indigo-50"><Tip text="Total sales year to date">YTD Sales</Tip></th>
              <th className="text-center px-3 py-2 bg-indigo-50"><Tip text="Affiliate-referred revenue year to date. Compare to YTD Sales to see how much of the year came from affiliates.">YTD Affiliate $</Tip></th>
              <th className="text-center px-3 py-2"><Tip text="Organic lead revenue this month">Organic $</Tip></th>
              <th className="text-center px-3 py-2"><Tip text="Affiliate referred revenue this month">Affiliate $</Tip></th>
              <th className="text-center px-3 py-2"><Tip text="Organic consult close rate this month: doc fees over organic consults">Org Close %</Tip></th>
              <th className="text-center px-3 py-2"><Tip text="Affiliate consult close rate this month: doc fees over affiliate consults. Compare to Org Close % to see the conversion difference.">Aff Close %</Tip></th>
              <th className="text-center px-3 py-2"><Tip text="Average revenue per client this month">Avg/Client</Tip></th>
              <th className="text-center px-3 py-2"><Tip text="Revenue per consult this month">$/Consult</Tip></th>
              <th className="text-center px-3 py-2"><Tip text="Average daily sales this month">Daily Avg</Tip></th>
              <th className="text-center px-3 py-2"><Tip text="Month-end projection based on current pace">Projected</Tip></th>
            </tr></thead>
            <tbody className="divide-y">{cons.map(c => (
              <tr key={c.name} className="hover:bg-slate-50">
                <td className="px-3 py-2.5 font-medium">{c.name.split(' ')[0]}</td>
                <td className="text-center px-3 py-2.5 bg-blue-50 font-bold">{fmtInt(c.totalSales)}</td>
                <td className="text-center px-3 py-2.5 bg-indigo-50 font-bold">{fmtInt(c.ytd?.sales||0)}</td>
                <Cell v={fmtInt(c.ytd?.affiliateSales||0)} good={(c.ytd?.affiliateSales||0) > 0} />
                <Cell v={fmtInt(c.organicSales)} /><Cell v={fmtInt(c.affiliateSales)} good={c.affiliateSales > 0} />
                <Cell v={(c.organicClosingPct||0)+'%'} /><Cell v={(c.affiliateClosingPct||0)+'%'} good={(c.affiliateClosingPct||0) > (c.organicClosingPct||0)} />
                <Cell v={'$'+(c.avgDealValue||0)} /><Cell v={'$'+(c.revenuePerConsult||0)} />
                <Cell v={'$'+(c.dailyAvgSales||0)} /><Cell v={fmtInt(c.projectedSales||0)} />
              </tr>
            ))}</tbody>
          </table></div>
        </div>
        )}

        {/* PRODUCTION */}
        {lbTab === 'production' && (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="p-4 border-b"><h3 className="font-bold text-slate-800">Production Metrics</h3></div>
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="bg-slate-50"><tr>
              <th className="text-left px-3 py-2">Consultant</th>
              <th className="text-center px-3 py-2"><Tip text="Ready to Quote consults from Pipedrive">Consults</Tip></th>
              <th className="text-center px-3 py-2"><Tip text="New doc fee clients this month">Onboarded</Tip></th>
              <th className="text-center px-3 py-2"><Tip text="Organic/direct clients added">Organic</Tip></th>
              <th className="text-center px-3 py-2"><Tip text="Affiliate referred clients added">Affiliate</Tip></th>
              <th className="text-center px-3 py-2"><Tip text="Overall doc fees / consults">Close %</Tip></th>
              <th className="text-center px-3 py-2"><Tip text="Closing rate on organic leads">Organic Close</Tip></th>
              <th className="text-center px-3 py-2"><Tip text="Closing rate on affiliate leads">Affiliate Close</Tip></th>
              <th className="text-center px-3 py-2"><Tip text="Doc fee + partial or final">Qualified</Tip></th>
              <th className="text-center px-3 py-2"><Tip text="Paid in full within 5 business days">PIF</Tip></th>
            </tr></thead>
            <tbody className="divide-y">{cons.map(c => (
              <tr key={c.name} className="hover:bg-slate-50">
                <td className="px-3 py-2.5 font-medium">{c.name.split(' ')[0]}</td>
                <Cell v={c.consultCount||0} /><Cell v={c.onboardedClients||0} />
                <Cell v={c.organicClientsAdded||0} /><Cell v={c.affiliateClientsAdded||0} good={(c.affiliateClientsAdded||0)>0} />
                <Cell v={(c.closingPct||0)+'%'} good={c.meetsClosingStandard} bad={!c.meetsClosingStandard} />
                <Cell v={(c.organicClosingPct||0)+'%'} /><Cell v={(c.affiliateClosingPct||0)+'%'} good={(c.affiliateClosingPct||0)>(c.organicClosingPct||0)} />
                <Cell v={c.qualifiedDocs||0} /><Cell v={c.pifCount||0} good={(c.pifCount||0)>0} />
              </tr>
            ))}</tbody>
          </table></div>
        </div>
        )}

        {/* PAYMENTS */}
        {lbTab === 'payments' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="p-4 border-b"><h3 className="font-bold text-slate-800">Payment Breakdown</h3></div>
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead className="bg-slate-50"><tr>
                <th className="text-left px-3 py-2">Consultant</th>
                <th className="text-center px-3 py-2"><Tip text="Total payment transactions">Payments</Tip></th>
                <th className="text-center px-3 py-2"><Tip text="Doc fees collected">Doc Fees</Tip></th>
                <th className="text-center px-3 py-2"><Tip text="Partial payments received">Partials</Tip></th>
                <th className="text-center px-3 py-2"><Tip text="Final payments received">Finals</Tip></th>
                <th className="text-center px-3 py-2"><Tip text="Doc fee clients who also paid partial/final (84% standard)">Pay-Past-Doc</Tip></th>
                <th className="text-center px-3 py-2"><Tip text="Doc fee 14+ days ago, no further payment">Past Due 14d</Tip></th>
                <th className="text-center px-3 py-2"><Tip text="Doc fee 30+ days ago, no further payment">Stale 30d</Tip></th>
              </tr></thead>
              <tbody className="divide-y">{cons.map(c => (
                <tr key={c.name} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-medium">{c.name.split(' ')[0]}</td>
                  <Cell v={c.paymentCount||0} /><Cell v={c.docFeeCount||0} />
                  <Cell v={c.partialCount||0} /><Cell v={c.finalCount||0} />
                  <Cell v={(c.payPastDocRate||0)+'%'} good={c.meetsPayPastDocStandard} bad={!c.meetsPayPastDocStandard} />
                  <Cell v={c.pastDueCount||0} bad={(c.pastDueCount||0)>3} />
                  <Cell v={c.staleCount||0} bad={(c.staleCount||0)>0} />
                </tr>
              ))}</tbody>
            </table></div>
          </div>
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="p-4 border-b"><h3 className="font-bold text-slate-800">Collection Metrics (from Zoho Invoices)</h3></div>
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead className="bg-slate-50"><tr>
                <th className="text-left px-3 py-2">Consultant</th>
                <th className="text-center px-3 py-2"><Tip text="Invoices past their due date">Overdue</Tip></th>
                <th className="text-center px-3 py-2"><Tip text="Total outstanding balance on overdue invoices">Overdue $</Tip></th>
                <th className="text-center px-3 py-2"><Tip text="Invoices with partial payment remaining">Partially Paid</Tip></th>
                <th className="text-center px-3 py-2"><Tip text="Invoices with balance due this week">Due This Week</Tip></th>
                <th className="text-center px-3 py-2"><Tip text="Amount due this week">Due $ This Week</Tip></th>
                <th className="text-center px-3 py-2"><Tip text="Total collected / total invoiced">Collection Rate</Tip></th>
              </tr></thead>
              <tbody className="divide-y">{cons.map(c => (
                <tr key={c.name} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-medium">{c.name.split(' ')[0]}</td>
                  <Cell v={c.overdueCount||0} bad={(c.overdueCount||0)>0} />
                  <Cell v={fmtInt(c.overdueAmount||0)} bad={(c.overdueAmount||0)>0} />
                  <Cell v={c.partiallyPaidCount||0} />
                  <Cell v={c.dueThisWeekCount||0} bad={(c.dueThisWeekCount||0)>3} />
                  <Cell v={fmtInt(c.dueThisWeekAmount||0)} />
                  <Cell v={(c.collectionRate||0)+'%'} good={(c.collectionRate||0)>=80} bad={(c.collectionRate||0)<60 && (c.collectionRate||0)>0} />
                </tr>
              ))}</tbody>
            </table></div>
          </div>
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="p-4 border-b"><h3 className="font-bold text-slate-800">Client Source — New vs Prior Month</h3></div>
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead className="bg-slate-50"><tr>
                <th className="text-left px-3 py-2">Consultant</th>
                <th className="text-center px-3 py-2"><Tip text="Clients who signed up this month">New Clients</Tip></th>
                <th className="text-center px-3 py-2"><Tip text="Revenue from new clients">New Revenue</Tip></th>
                <th className="text-center px-3 py-2"><Tip text="Prior month clients making payments">Prior Clients</Tip></th>
                <th className="text-center px-3 py-2"><Tip text="Revenue from prior month clients">Prior Revenue</Tip></th>
                <th className="text-center px-3 py-2"><Tip text="Clients 30+ days without final payment">Pending 30d</Tip></th>
                <th className="text-center px-3 py-2"><Tip text="Clients 90+ days without final payment">Pending 90d</Tip></th>
              </tr></thead>
              <tbody className="divide-y">{cons.map(c => (
                <tr key={c.name} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-medium">{c.name.split(' ')[0]}</td>
                  <Cell v={c.thisMonthClientCount||0} /><Cell v={fmtInt(c.thisMonthRevenue||0)} />
                  <Cell v={c.priorMonthClientCount||0} /><Cell v={fmtInt(c.priorMonthRevenue||0)} />
                  <Cell v={c.pendingCount30||0} bad={(c.pendingCount30||0)>3} />
                  <Cell v={c.pendingCount90||0} bad={(c.pendingCount90||0)>0} />
                </tr>
              ))}</tbody>
            </table></div>
          </div>
        </div>
        )}

        {/* QUALITY */}
        {lbTab === 'quality' && (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="p-4 border-b"><h3 className="font-bold text-slate-800">Quality and Standards</h3></div>
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="bg-slate-50"><tr>
              <th className="text-left px-3 py-2">Consultant</th>
              <th className="text-center px-3 py-2"><Tip text="Reviews assigned this month (10 standard)">Reviews</Tip></th>
              <th className="text-center px-3 py-2"><Tip text="Affiliates sending 3+ clients">Affiliates</Tip></th>
              <th className="text-center px-3 py-2"><Tip text="Refunds processed this month">Refunds</Tip></th>
              <th className="text-center px-3 py-2"><Tip text="Weekly sprints won ($150/week)">Sprint Wins</Tip></th>
              <th className="text-center px-3 py-2"><Tip text="Meets docs + affiliates + reviews for COTM">COTM Ready</Tip></th>
            </tr></thead>
            <tbody className="divide-y">{cons.map(c => (
              <tr key={c.name} className="hover:bg-slate-50">
                <td className="px-3 py-2.5 font-medium">{c.name.split(' ')[0]}</td>
                <Cell v={c.reviewCount||0} good={c.meetsReviewStandard} bad={!c.meetsReviewStandard} />
                <Cell v={c.producingAffiliates||0} good={(c.producingAffiliates||0)>=5} />
                <Cell v={c.refundCount||0} bad={(c.refundCount||0)>0} />
                <Cell v={c.weeksWon||0} good={(c.weeksWon||0)>0} />
                <td className="text-center px-3 py-2.5">{c.meetsReviewStandard && (c.producingAffiliates||0)>=5 ? 'Yes' : 'No'}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </div>
        )}

        {/* SPRINT */}
        {lbTab === 'sprint' && (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="p-4 border-b"><h3 className="font-bold text-slate-800">Weekly Sprint Results ($150/week)</h3></div>
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="bg-slate-50"><tr>
              <th className="text-left px-3 py-2">Week</th>
              {cons.map(c => <th key={c.name} className="text-center px-3 py-2">{c.name.split(' ')[0]}</th>)}
              <th className="text-center px-3 py-2">Result</th>
            </tr></thead>
            <tbody className="divide-y">
              {(data.weeklyWinners || []).map(w => (
                <tr key={w.week} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-medium">Wk {w.week} ({fmtDate(w.start)})</td>
                  {cons.map(c => {
                    const wk = (c.weeks||[]).find(cw => cw.week === w.week);
                    const isLead = w.leader === c.name;
                    return <td key={c.name} className={`text-center px-3 py-2.5 ${isLead ? 'text-orange-600 font-bold bg-orange-50' : ''}`}>{wk?.docs || 0}{isLead && w.complete ? ' W' : isLead ? ' *' : ''}</td>;
                  })}
                  <td className="text-center px-3 py-2.5 font-medium">{w.complete ? (w.winner||'').split(' ')[0]+' ('+w.docs+')' : 'In Progress'}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
        )}

        {data.consultantOfMonth && (
          <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
            <p className="font-medium text-amber-800">Consultant of the Month: <strong>{data.consultantOfMonth}</strong></p>
          </div>
        )}
        </div>);
      })()}

      {tab === 'bonuses' && (<>
      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border shadow-sm">
          <Target size={18} className="text-blue-500 mb-2" />
          <p className="text-3xl font-bold text-slate-800">{c.qualifiedDocs}</p>
          <p className="text-sm text-slate-500"><Tip text="Clients who paid a doc fee this month and either paid their balance in full, or paid a partial in full that is at least the final amount. A token partial against a still-open balance does not count. Drives the Accelerator and Doc Club.">Qualified Docs</Tip></p>
          <DrillButton onClick={() => setExpandedSection(expandedSection === 'qualified' ? null : 'qualified')} label="View clients" />
          {expandedSection === 'qualified' && c.clientDetail && (
            <ClientPanel title="Qualified Docs — Payment Journey" items={[...(c.clientDetail.qualifiedList||[]), ...(c.clientDetail.notQualifiedList||[])]} onClose={() => setExpandedSection(null)} />
          )}
          {docsToNext > 0 && <p className="text-xs text-blue-500 mt-1">{c.qualifiedDocs} of {c.qualifiedDocs + docsToNext} → {nextTierLabel}</p>}
        </div>
        <div className="bg-white rounded-xl p-4 border shadow-sm">
          <DollarSign size={18} className="text-green-500 mb-2" />
          <p className="text-3xl font-bold text-slate-800">{fmtInt(c.totalSales)}</p>
          <p className="text-sm text-slate-500"><Tip text="Total payments received this month from all clients, pulled live from Zoho Invoice. Click to see every payment.">MTD Sales</Tip></p>
          <DrillButton onClick={() => setExpandedSection(expandedSection === 'mtd' ? null : 'mtd')} label="View payments" />
          {expandedSection === 'mtd' && c.clientDetail?.mtdList && (
            <ClientPanel title={`MTD Sales — ${c.clientDetail.mtdList.length} payments = ${fmtInt(c.totalSales)}`} items={c.clientDetail.mtdList} onClose={() => setExpandedSection(null)} />
          )}
        </div>
        <div className="bg-white rounded-xl p-4 border shadow-sm">
          <Users size={18} className="text-purple-500 mb-2" />
          <p className="text-3xl font-bold text-slate-800">{c.producingAffiliates}</p>
          <p className="text-sm text-slate-500"><Tip text="Affiliate organizations that sent you 3 or more qualified clients this month (a qualified client paid their doc fee and at least a partial). Standard is 5 active affiliates per month. Click to see all affiliate orgs and their client counts.">Active Affiliates</Tip></p>
          <DrillButton onClick={() => setExpandedSection(expandedSection === 'affiliates' ? null : 'affiliates')} label="View affiliates" />
          {expandedSection === 'affiliates' && c.clientDetail?.affiliateOrgList && (
            <ClientPanel
              title={`Affiliate Orgs — ${c.producingAffiliates} active (3+ qualified clients)`}
              items={c.clientDetail.affiliateOrgList.map(o => ({ name: `${o.name} — ${o.clients} qualified client${o.clients !== 1 ? 's' : ''}`, type: o.producing ? 'final' : 'no_doc' }))}
              onClose={() => setExpandedSection(null)}
            />
          )}
          {c.producingAffiliates < 5 && <p className="text-xs text-purple-500 mt-1">{5 - c.producingAffiliates} more to bonus threshold</p>}
        </div>
        <div className="bg-white rounded-xl p-4 border shadow-sm">
          <div className={`flex items-center gap-1 mb-2 ${c.meetsClosingStandard ? 'text-green-500' : 'text-red-500'}`}>
            {c.meetsClosingStandard ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          </div>
          <p className="text-3xl font-bold text-slate-800">{c.closingPct}%</p>
          <p className="text-sm text-slate-500"><Tip text="Deals that moved into Quoted (Ready to Quote) this month that paid a doc fee, divided by all deals that moved into Quoted. Click to see the deals.">Closing Rate</Tip></p>
          {!c.meetsClosingStandard && <p className="text-xs text-red-500 mt-1">Below 40% standard</p>}
          <DrillButton onClick={() => setExpandedSection(expandedSection === 'close' ? null : 'close')} label="View quoted deals" />
          {expandedSection === 'close' && c.closeDetail && (
            <ClientPanel
              title={`Closing Rate — ${c.docsPaid} of ${c.consultCount} quoted paid a doc fee = ${c.closingPct}%`}
              items={c.closeDetail.map(d => ({ name: d.matchBy === 'name (no deal id on invoice)' ? `${d.name}  ⚠ matched by name` : d.name, dealId: d.dealId, amount: d.amount, type: d.paidDocFee ? 'doc_fee' : 'no_doc' }))}
              onClose={() => setExpandedSection(null)}
            />
          )}
        </div>
      </div>

      {/* Bonus Breakdown */}
      <div className="bg-white rounded-xl border shadow-sm">
        <div className="p-4 border-b"><h3 className="font-bold text-slate-800">Bonus Breakdown</h3></div>
        <div className="divide-y">
          {/* Accelerator */}
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Zap size={20} className={c.accelerator.total > 0 ? 'text-amber-500' : 'text-slate-300'} />
                <div>
                  <p className="font-medium text-slate-800"><Tip text="Earn extra per qualified doc: $10 each at 51-60, $20 at 61-70, $30 at 71-80, $45 at 81+. Qualified doc = client with doc fee AND partial or final payment.">Doc Production Accelerator</Tip></p>
                  <p className="text-sm text-slate-500">
                    {c.qualifiedDocs <= 50 ? `${50 - c.qualifiedDocs} docs to unlock (need 51+)` :
                    c.accelerator.breakdown.map(b => `${b.docs} docs × $${b.perDoc}`).join(' + ')}
                  </p>
                </div>
              </div>
              <p className={`text-lg font-bold ${c.accelerator.total > 0 ? 'text-amber-600' : 'text-slate-300'}`}>{fmt(c.accelerator.total)}</p>
            </div>
            {/* Progress bar to next tier */}
            {c.qualifiedDocs < 90 && (
              <div className="mt-3 flex gap-1">
                {[{max:50,label:'1-50'},{max:60,label:'51-60'},{max:70,label:'61-70'},{max:80,label:'71-80'},{max:90,label:'81-90'}].map(band => {
                  const filled = Math.min(100, Math.max(0, ((c.qualifiedDocs - (band.max - 10)) / 10) * 100));
                  return (
                    <div key={band.label} className="flex-1">
                      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${filled >= 100 ? 'bg-amber-500' : filled > 0 ? 'bg-amber-300' : ''}`} style={{width: Math.max(0, filled) + '%'}} />
                      </div>
                      <p className="text-[10px] text-slate-400 text-center mt-1">{band.label}</p>
                    </div>
                  );
                })}
              </div>
            )}
            <DrillButton onClick={() => setExpandedSection(expandedSection === 'accel' ? null : 'accel')} label="View qualified docs" />
            {expandedSection === 'accel' && c.clientDetail?.qualifiedList && (
              <ClientPanel title={`Qualified Docs driving the Accelerator (${c.qualifiedDocs})`} items={[...(c.clientDetail.qualifiedList||[]), ...(c.clientDetail.notQualifiedList||[])]} onClose={() => setExpandedSection(null)} />
            )}
          </div>

          {/* Doc Club */}
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Award size={20} className={c.docClub ? 'text-blue-500' : 'text-slate-300'} />
              <div>
                <p className="font-medium text-slate-800"><Tip text="One-time monthly bonus for hitting Qualified Doc milestones: $100 at 60 Qualified Docs, $200 at 75, $350 at 90. Highest tier only, does not stack.">Doc Club Milestone</Tip></p>
                <p className="text-sm text-slate-500">{c.docClub ? c.docClub.label : c.qualifiedDocs < 60 ? `${c.qualifiedDocs} of 60 (${60 - c.qualifiedDocs} to go)` : 'No milestone hit'}</p>
              </div>
            </div>
            <p className={`text-lg font-bold ${c.docClubBonus > 0 ? 'text-blue-600' : 'text-slate-300'}`}>{fmt(c.docClubBonus)}</p>
          </div>

          {/* PIF Fast Start */}
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Zap size={20} className={c.pifCount > 0 ? 'text-green-500' : 'text-slate-300'} />
                <div>
                  <p className="font-medium text-slate-800"><Tip text="$25 bonus for each client who pays doc fee AND final payment (no partial) within 5 business days. Client must skip the payment plan and pay in full quickly.">Paid-in-Full Fast Start</Tip></p>
                  <p className="text-sm text-slate-500">{c.pifCount} clients × $25</p>
                </div>
              </div>
              <p className={`text-lg font-bold ${c.pifBonus > 0 ? 'text-green-600' : 'text-slate-300'}`}>{fmt(c.pifBonus)}</p>
            </div>
            {c.pifCount > 0 && <DrillButton onClick={() => setExpandedSection(expandedSection === 'pif' ? null : 'pif')} label={`View ${c.pifCount} PIF clients`} />}
            {expandedSection === 'pif' && c.pifClients && (
              <ClientPanel title="PIF Fast Start Clients" items={c.pifClients.map(p => ({ name: p.name, amount: p.finalAmount, type: 'PIF', date: p.finalDate, payments: [{ type: 'doc_fee', amount: p.docAmount, date: p.docDate }, { type: 'final', amount: p.finalAmount, date: p.finalDate }] }))} onClose={() => setExpandedSection(null)} />
            )}
          </div>

          {/* Reactivation Kicker */}
          {(c.reactivationCount > 0 || true) && (
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <RefreshCw size={20} className={c.reactivationCount > 0 ? 'text-teal-500' : 'text-slate-300'} />
                <div>
                  <p className="font-medium text-slate-800"><Tip text="$75 one-time bonus for reviving a dormant affiliate. Dormant = affiliate org that has not sent a paying client in 90+ days, then sends a new one.">Reactivation Kicker</Tip></p>
                  <p className="text-sm text-slate-500">{c.reactivationCount || 0} dormant affiliates revived × $75</p>
                </div>
              </div>
              <p className={`text-lg font-bold ${c.reactivationBonus > 0 ? 'text-teal-600' : 'text-slate-300'}`}>{fmt(c.reactivationBonus || 0)}</p>
            </div>
            {c.reactivationCount > 0 && <DrillButton onClick={() => setExpandedSection(expandedSection === 'reactivation' ? null : 'reactivation')} label={`View ${c.reactivationCount} reactivated`} />}
            {expandedSection === 'reactivation' && c.reactivatedOrgs && (
              <ClientPanel title="Reactivated Affiliates (90+ Days Dormant)" items={c.reactivatedOrgs.map(o => ({ name: o.name, amount: 75, type: `${o.daysDormant} days dormant`, date: o.reactivatedOn }))} onClose={() => setExpandedSection(null)} />
            )}
          </div>
          )}

          {/* New Affiliate Launch */}
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Gift size={20} className={c.newAffiliateLaunchCount > 0 ? 'text-indigo-500' : 'text-slate-300'} />
                <div>
                  <p className="font-medium text-slate-800"><Tip text="$75 one-time bonus when a brand new affiliate sends 3 or more qualified clients within their first 60 days. One-time per affiliate, never repeats. The list also shows new affiliates with 1-2 clients so far so you can reach out and ask for more referrals.">New Affiliate Launch</Tip></p>
                  <p className="text-sm text-slate-500">{c.newAffiliateLaunchCount || 0} earning ($75 each){(c.newAffiliateAllOrgs?.length || 0) > (c.newAffiliateLaunchCount || 0) ? ` · ${(c.newAffiliateAllOrgs.length - (c.newAffiliateLaunchCount || 0))} new affiliate${(c.newAffiliateAllOrgs.length - (c.newAffiliateLaunchCount || 0)) === 1 ? '' : 's'} not yet at 3` : ''}</p>
                </div>
              </div>
              <p className={`text-lg font-bold ${c.newAffiliateLaunchBonus > 0 ? 'text-indigo-600' : 'text-slate-300'}`}>{fmt(c.newAffiliateLaunchBonus || 0)}</p>
            </div>
            {c.newAffiliateAllOrgs?.length > 0 && <DrillButton onClick={() => setExpandedSection(expandedSection === 'newaffiliate' ? null : 'newaffiliate')} label={`View ${c.newAffiliateAllOrgs.length} new affiliate${c.newAffiliateAllOrgs.length === 1 ? '' : 's'}`} />}
            {expandedSection === 'newaffiliate' && c.newAffiliateAllOrgs && (
              <ClientPanel title="New Affiliates (org created in last 60 days)" items={c.newAffiliateAllOrgs.map(o => ({ name: o.name, amount: o.qualifies ? 75 : undefined, type: `${o.clients} client${o.clients === 1 ? '' : 's'} · org created ${o.daysSinceCreated}d ago`, date: o.firstDate, reason: o.qualifies ? null : `${o.clients} of 3 clients — reach out for more referrals` }))} onClose={() => setExpandedSection(null)} />
            )}
          </div>

          {/* Affiliate Bonus */}
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users size={20} className={c.affiliateBonus > 0 ? 'text-purple-500' : 'text-slate-300'} />
                <div>
                  <p className="font-medium text-slate-800"><Tip text="Bonus for building a strong affiliate network. First 5 producing affiliates (3+ clients each) are your baseline. Starting with the 6th, earn $50 (3-5 clients), $110 (6-10), or $200 (11+) per affiliate.">Active Affiliate Bonus</Tip></p>
                  <p className="text-sm text-slate-500">{c.producingAffiliates} producing affiliates ({c.producingAffiliates > 5 ? c.producingAffiliates - 5 : 0} earning bonus)</p>
                </div>
              </div>
              <p className={`text-lg font-bold ${c.affiliateBonus > 0 ? 'text-purple-600' : 'text-slate-300'}`}>{fmt(c.affiliateBonus)}</p>
            </div>
            {c.affiliateDetail.length > 0 && (
              <div className="mt-2 ml-8 space-y-1">
                {c.affiliateDetail.map((aff, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-slate-600">{aff.name} <span className="text-slate-400">({aff.clients} clients)</span></span>
                    <span className={i < 5 ? 'text-slate-400' : 'text-purple-600 font-medium'}>{i < 5 ? 'Base (no bonus)' : fmt(c.affiliateBonusDetail.find(b => b.name === aff.name)?.bonus || 0)}</span>
                  </div>
                ))}
              </div>
            )}
            {c.clientDetail?.affiliateClients?.length > 0 && (
              <DrillButton onClick={() => setExpandedSection(expandedSection === 'affclients' ? null : 'affclients')} label="View clients" />
            )}
            {expandedSection === 'affclients' && c.clientDetail?.affiliateClients && (
              <ClientPanel title="Affiliate Clients by Org" items={c.clientDetail.affiliateClients} onClose={() => setExpandedSection(null)} />
            )}
          </div>

          {/* Reviews */}
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Star size={20} className={c.meetsReviewStandard ? 'text-yellow-500' : 'text-slate-300'} />
                <div>
                  <p className="font-medium text-slate-800"><Tip text="$5 bonus for each assigned review above 10 per month. BBB reviews earn an extra $50 each. Reviews must be assigned to you in the Playbook.">Client Reviews</Tip></p>
                  <p className="text-sm text-slate-500">{c.reviewCount} reviews ({c.reviewCount >= 10 ? `${c.reviewCount - 10} over standard` : `${10 - c.reviewCount} to meet standard`}){c.bbbReviews > 0 ? ` + ${c.bbbReviews} BBB` : ''}</p>
                </div>
              </div>
              <p className={`text-lg font-bold ${c.reviewBonus > 0 ? 'text-yellow-600' : 'text-slate-300'}`}>{fmt(c.reviewBonus)}</p>
            </div>
            <DrillButton onClick={() => setExpandedSection(expandedSection === 'reviews' ? null : 'reviews')} label={`View ${c.reviewCount} reviews`} />
            {expandedSection === 'reviews' && c.clientDetail?.reviewList && (
              <ClientPanel title={`Assigned Reviews (${c.reviewCount} total, bonus starts after 10)`} items={c.clientDetail.reviewList.map(r => ({ name: r.reviewer, type: `⭐ ${r.rating}/5`, date: r.date, payments: [{ type: 'review', amount: 0, date: `${r.location} — "${r.text}..."` }] }))} onClose={() => setExpandedSection(null)} />
            )}
          </div>

          {/* Weekly Sprint */}
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock size={20} className={data.weeklyWinners?.some(w => w.winner === c.name) ? 'text-orange-500' : 'text-slate-300'} />
                <div>
                  <p className="font-medium text-slate-800"><Tip text="$150 awarded each week to the consultant with the most doc fees collected Monday through Sunday. Winner declared after the week ends.">Weekly Sprint ($150/week)</Tip></p>
                  <p className="text-sm text-slate-500">
                    {(data.weeklyWinners || []).filter(w => w.winner === c.name).length} week{(data.weeklyWinners || []).filter(w => w.winner === c.name).length !== 1 ? 's' : ''} won
                  </p>
                </div>
              </div>
              <p className={`text-lg font-bold ${(data.weeklyWinners || []).some(w => w.winner === c.name) ? 'text-orange-600' : 'text-slate-300'}`}>
                {fmt((data.weeklyWinners || []).filter(w => w.winner === c.name).length * 150)}
              </p>
            </div>
            {(data.weeklyWinners || []).length > 0 && (
              <div className="mt-2 ml-8 space-y-1">
                {(data.weeklyWinners || []).map((w, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-slate-600">Week {w.week} ({fmtDate(w.start)} — {fmtDate(w.end)})</span>
                    <span className={w.winner === c.name ? 'text-orange-600 font-bold' : 'text-slate-400'}>
                      {w.winner === c.name ? `🏆 Won (${w.docs} docs)` : `${(c.weeks || []).find(cw => cw.week === w.week)?.docs || 0} docs — ${w.winner?.split(' ')[0]} won (${w.docs})`}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <DrillButton onClick={() => setExpandedSection(expandedSection === 'sprint' ? null : 'sprint')} label="View weekly breakdown" />
            {expandedSection === 'sprint' && (
              <ClientPanel title="Weekly Sprint Breakdown" items={(c.weeks || []).map(w => {
                const winner = data.weeklyWinners?.find(ww => ww.week === w.week);
                const won = !!(winner?.complete && winner?.winner === c.name);
                const leading = !!(!winner?.complete && winner?.leader === c.name);
                return { name: `Week ${w.week} (${fmtDate(w.start)} — ${fmtDate(w.end)})`, amount: won ? 150 : 0, type: `${w.docs} doc fees${won ? ' — Won $150' : leading ? ' — Leading' : ''}`, date: winner?.complete ? (won ? '🏆 Winner' : `${(winner?.winner||'').split(' ')[0]} won`) : 'In progress', onClick: () => setSprintWeek(w), clientCount: w.docs };
              })} onClose={() => { setExpandedSection(null); setSprintWeek(null); }} />
            )}
            {sprintWeek && (
              <ClientPanel title={`Week ${sprintWeek.week} Doc Fees (${fmtDate(sprintWeek.start)} — ${fmtDate(sprintWeek.end)})`}
                items={(sprintWeek.clients || []).map(cl => ({ name: cl.name, amount: cl.amount, dealId: cl.dealId, date: cl.date, type: 'doc_fee' }))}
                onClose={() => setSprintWeek(null)} />
            )}
          </div>

          {/* COTM */}
          <div className="p-4 flex items-center justify-between bg-gradient-to-r from-amber-50 to-orange-50">
            <div className="flex items-center gap-3">
              <Trophy size={20} className={data.consultantOfMonth === c.name ? 'text-amber-500' : 'text-slate-300'} />
              <div>
                <p className="font-medium text-slate-800"><Tip text="$500 monthly award. Must lead in qualified docs AND have 5+ active affiliates AND meet the 10-review standard. All three criteria required.">Consultant of the Month</Tip></p>
                <p className="text-sm text-slate-500">
                  {data.consultantOfMonth === c.name ? '🏆 You qualify!' :
                  !c.meetsReviewStandard ? 'Need 10+ reviews' :
                  c.producingAffiliates < 5 ? 'Need 5+ active affiliates' :
                  'Need most qualified docs'}
                </p>
              </div>
            </div>
            <p className={`text-lg font-bold ${data.consultantOfMonth === c.name ? 'text-amber-600' : 'text-slate-300'}`}>{data.consultantOfMonth === c.name ? '$500.00' : '$0.00'}</p>
          </div>

          {/* Total */}
          <div className="p-4 bg-slate-800 text-white flex items-center justify-between rounded-b-xl">
            <p className="font-bold text-lg">Total Bonuses</p>
            <p className="text-2xl font-bold text-emerald-400">{fmt(c.totalBonus)}</p>
          </div>
        </div>
      </div>

      {/* Past Due Invoices — outreach list */}
      <div className="bg-white rounded-xl border shadow-sm p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} className={(c.pastDueInvoiceCount||0) > 0 ? 'text-rose-500' : 'text-slate-300'} />
            <div>
              <h3 className="font-bold text-slate-800"><Tip text="Clients from this month and last month who still owe on an invoice (overdue or partially paid). Reach out to collect. Click a client to open their Pipedrive deal.">Past Due Invoices</Tip></h3>
              <p className="text-sm text-slate-500">{c.pastDueInvoiceCount || 0} client{(c.pastDueInvoiceCount||0) === 1 ? '' : 's'} from this and last month owing {fmt(c.pastDueOwed || 0)}</p>
            </div>
          </div>
          {(c.clientDetail?.pastDueList?.length || 0) > 0 && (
            <DrillButton onClick={() => setExpandedSection(expandedSection === 'pastdue' ? null : 'pastdue')} label="View clients" />
          )}
        </div>
        {expandedSection === 'pastdue' && c.clientDetail?.pastDueList && (
          <ClientPanel title="Past Due Invoices — Reach Out" items={c.clientDetail.pastDueList.map(p => ({ name: p.name, dealId: p.dealId, type: `$${p.balance} owed${p.daysOverdue != null && p.daysOverdue > 0 ? ` · ${p.daysOverdue}d overdue` : (p.status === 'partially_paid' ? ' · partially paid' : '')}`, date: p.dueDate }))} onClose={() => setExpandedSection(null)} />
        )}
      </div>

      {/* Commission Detail */}
      <div className="bg-white rounded-xl border shadow-sm p-4">
        <h3 className="font-bold text-slate-800 mb-3">Commission Detail (Live from Zoho)</h3>
        <div className="space-y-2 text-sm">
          <div>
            <div className="flex justify-between"><span className="text-slate-600"><Tip text="Clients from Google, website, direct calls. Commission at base rate.">Organic Sales ({c.baseRate})</Tip></span><span className="font-medium">{fmt(c.organicSales)} × {c.baseRate} = {fmt(c.baseCommission)}</span></div>
            <DrillButton onClick={() => setExpandedSection(expandedSection === 'google' ? null : 'google')} label={`View ${c.clientDetail?.organicClients?.length || 0} clients`} />
            {expandedSection === 'google' && c.clientDetail && (
              <ClientPanel title={`Organic Clients — ${c.baseRate}`} items={c.clientDetail.organicClients} onClose={() => setExpandedSection(null)} />
            )}
          </div>
          <div>
            <div className="flex justify-between"><span className="text-slate-600"><Tip text="Clients referred by affiliates with Consultant Referral label. Higher commission rate.">Affiliate Sales ({c.affiliateRate})</Tip></span><span className="font-medium">{fmt(c.affiliateSales)} × {c.affiliateRate} = {fmt(c.affiliateCommission)}</span></div>
            <DrillButton onClick={() => setExpandedSection(expandedSection === 'affiliate' ? null : 'affiliate')} label={`View ${c.clientDetail?.affiliateClients?.length || 0} clients`} />
            {expandedSection === 'affiliate' && c.clientDetail && (
              <ClientPanel title={`Affiliate Clients — ${c.affiliateRate}`} items={c.clientDetail.affiliateClients} onClose={() => setExpandedSection(null)} />
            )}
          </div>
          <div className="flex justify-between pt-2 border-t font-bold"><span>Total Commission</span><span className="text-green-600">{fmt(c.totalCommission)}</span></div>
        </div>
      </div>

      {/* Protection Metrics */}
      <div className="bg-white rounded-xl border shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <Shield size={18} className="text-slate-500" />
          <h3 className="font-bold text-slate-800">Protection Standards</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div className={`p-3 rounded-lg cursor-pointer ${c.meetsClosingStandard ? 'bg-green-50 border border-green-200 hover:bg-green-100' : 'bg-red-50 border border-red-200 hover:bg-red-100'}`} onClick={() => setExpandedSection(expandedSection === 'closing' ? null : 'closing')}>
            <p className="text-xs text-slate-500"><Tip text="Doc fees collected divided by total Ready to Quote consults. Standard: 40% minimum.">Closing %</Tip></p>
            <p className="text-lg font-bold">{c.closingPct}%</p>
            <p className="text-xs">{c.meetsClosingStandard ? '✅ Above 40%' : '⚠️ Below 40%'}</p>
            <p className="text-xs text-blue-400 mt-1">👆 {c.docsPaid}/{c.consultCount}</p>
          </div>
          <div className={`p-3 rounded-lg ${c.meetsPayPastDocStandard ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <p className="text-xs text-slate-500"><Tip text="Of clients who paid doc fee this month, what percentage also made a partial or final payment? Standard: 84% minimum.">Pay-Past-Doc %</Tip></p>
            <p className="text-lg font-bold">{c.payPastDocRate || 0}%</p>
            <p className="text-xs">{c.meetsPayPastDocStandard ? '✅ Above 84%' : '⚠️ Below 84%'}</p>
          </div>
          <div className={`p-3 rounded-lg ${c.refundCount === 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <p className="text-xs text-slate-500"><Tip text="Number of refunds processed for your clients this month.">Refunds</Tip></p>
            <p className="text-lg font-bold">{c.refundCount || 0}</p>
            <p className="text-xs">{c.refundCount === 0 ? '✅ No refunds' : `⚠️ ${fmt(c.refundAmount)} refunded`}</p>
          </div>
          <div className={`p-3 rounded-lg ${c.meetsReviewStandard ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <p className="text-xs text-slate-500"><Tip text="Client reviews assigned to you. Standard: 10 minimum per month.">Reviews</Tip></p>
            <p className="text-lg font-bold">{c.reviewCount}</p>
            <p className="text-xs">{c.meetsReviewStandard ? '✅ Meets 10 standard' : `⚠️ ${10 - c.reviewCount} short`}</p>
          </div>
          <div className="p-3 rounded-lg bg-green-50 border border-green-200">
            <p className="text-xs text-slate-500"><Tip text="Affiliate partners who sent 3+ clients this month. Standard: 5 minimum.">Active Affiliates</Tip></p>
            <p className="text-lg font-bold">{c.producingAffiliates}</p>
            <p className="text-xs">{c.producingAffiliates >= 5 ? '✅ 5+ active' : `${5 - c.producingAffiliates} to minimum`}</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <p className="text-xs text-slate-500"><Tip text="Your doc fee count this week. Top closer wins $150.">Weekly Sprint</Tip></p>
            <p className="text-lg font-bold">{c.weeklyDocs} docs</p>
            <p className="text-xs">{data.sprintWinner === c.name ? '🏆 Leading' : `Leader: ${data.sprintMaxDocs}`}</p>
          </div>
        </div>
        {expandedSection === 'closing' && c.clientDetail?.consultList && (
          <ClientPanel title={`Closing % Detail — ${c.docsPaid} paid / ${c.consultCount} consults = ${c.closingPct}%`} items={c.clientDetail.consultList.map(cl => ({ name: cl.clientName, amount: cl.amount, type: cl.paid ? '✅ Paid Doc Fee' : '❌ Not Paid', date: cl.date }))} onClose={() => setExpandedSection(null)} />
        )}
      </div>
      <div className="bg-white rounded-xl border shadow-sm p-4">
        <h3 className="font-bold text-slate-800 mb-3">Payment Breakdown (Live from Zoho)</h3>
        <div className="grid grid-cols-4 gap-3 text-center mb-3">
          <div className="p-2 bg-blue-50 rounded-lg cursor-pointer hover:bg-blue-100" onClick={() => setExpandedSection(expandedSection === 'allpay' ? null : 'allpay')}>
            <p className="text-2xl font-bold text-blue-600">{c.paymentCount || 0}</p>
            <p className="text-xs text-slate-500">Total Payments</p>
            <p className="text-xs text-blue-400">👆 View</p>
          </div>
          <div className="p-2 bg-amber-50 rounded-lg cursor-pointer hover:bg-amber-100" onClick={() => setExpandedSection(expandedSection === 'docs' ? null : 'docs')}>
            <p className="text-2xl font-bold text-amber-600">{c.docFeeCount || 0}</p>
            <p className="text-xs text-slate-500">Doc Fees</p>
            <p className="text-xs text-amber-400">👆 View</p>
          </div>
          <div className="p-2 bg-purple-50 rounded-lg cursor-pointer hover:bg-purple-100" onClick={() => setExpandedSection(expandedSection === 'partials' ? null : 'partials')}>
            <p className="text-2xl font-bold text-purple-600">{c.partialCount || 0}</p>
            <p className="text-xs text-slate-500">Partials</p>
            <p className="text-xs text-purple-400">👆 View</p>
          </div>
          <div className="p-2 bg-green-50 rounded-lg cursor-pointer hover:bg-green-100" onClick={() => setExpandedSection(expandedSection === 'finals' ? null : 'finals')}>
            <p className="text-2xl font-bold text-green-600">{c.finalCount || 0}</p>
            <p className="text-xs text-slate-500">Finals</p>
            <p className="text-xs text-green-400">👆 View</p>
          </div>
        </div>
        {expandedSection === 'allpay' && c.clientDetail && (
          <ClientPanel title="All Payments" items={[...c.clientDetail.organicClients, ...c.clientDetail.affiliateClients].sort((a,b) => b.date?.localeCompare(a.date))} onClose={() => setExpandedSection(null)} />
        )}
        {expandedSection === 'docs' && c.clientDetail && (
          <ClientPanel title="Doc Fee Payments" items={c.clientDetail.docFeeList} onClose={() => setExpandedSection(null)} />
        )}
        {expandedSection === 'partials' && c.clientDetail && (
          <ClientPanel title="Partial Payments" items={c.clientDetail.partialList} onClose={() => setExpandedSection(null)} />
        )}
        {expandedSection === 'finals' && c.clientDetail && (
          <ClientPanel title="Final Payments" items={c.clientDetail.finalList} onClose={() => setExpandedSection(null)} />
        )}
        <p className="text-xs text-slate-400 text-right mt-2">Data source: Zoho Invoice API • {data.totalPayments || 0} payments this month</p>
      </div>
      </>)}
    </div>
  );
}
