import { useEffect, useState } from 'react';

// COMMAND CENTER P2 - tabs: Overview / CSR / AM / Consultant / Credit / Pipelines.
// Overview = funnel + reviews (both range-filtered). Dept tabs = core KPIs only.
// No bonus dollars anywhere.

const CC_URL = '/.netlify/functions/admin-command-center';
const CSR_URL = '/.netlify/functions/csr-bonus-metrics';
const AM_HELPERS = {
  csat: '/.netlify/functions/am-csat',
  referrals: '/.netlify/functions/am-referrals',
  stall: '/.netlify/functions/am-stall-rate',
  rounds: '/.netlify/functions/am-additional-rounds',
};
const CONS_URL = '/.netlify/functions/consultant-bonus-metrics';
const CREDIT_URL = '/.netlify/functions/credit-team-bonus-metrics';
const DEAL_URL = (id) => `https://asapcreditrepair.pipedrive.com/deal/${id}`;

const ctToday = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const shiftDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
function rangeFor(key) {
  const t = ctToday();
  if (key === 'today') return [iso(t), iso(t)];
  if (key === 'yesterday') { const y = shiftDays(t, -1); return [iso(y), iso(y)]; }
  if (key === 'week') return [iso(shiftDays(t, -6)), iso(t)];
  if (key === 'twoweeks') return [iso(shiftDays(t, -13)), iso(t)];
  if (key === 'month') return [`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-01`, iso(t)];
  if (key === 'lastmonth') {
    const first = new Date(t.getFullYear(), t.getMonth() - 1, 1);
    const last = new Date(t.getFullYear(), t.getMonth(), 0);
    return [iso(first), iso(last)];
  }
  return [iso(t), iso(t)];
}
const titleize = (s) => String(s).replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' ').replace(/^./, (c) => c.toUpperCase()).trim();

function Stat({ label, value, sub, accent, onClick }) {
  return (
    <div onClick={onClick}
      className={`bg-white rounded-xl border border-slate-200 p-4 ${onClick ? 'cursor-pointer hover:border-indigo-400 transition' : ''}`}>
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={`text-2xl font-bold ${accent || 'text-slate-800'}`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}
function Arrow({ pct, label }) {
  const color = pct >= 50 ? 'text-emerald-600' : pct >= 25 ? 'text-amber-600' : 'text-rose-600';
  return (
    <div className="flex flex-col items-center justify-center px-1 shrink-0">
      <div className={`text-sm font-bold ${color}`}>{pct}%</div>
      <div className="text-[10px] text-slate-400 whitespace-nowrap">{label} &rarr;</div>
    </div>
  );
}
// Generic numeric-KPI renderer for objects whose exact shape can evolve.
function KpiGrid({ obj, skip = [] }) {
  if (!obj || typeof obj !== 'object') return null;
  const entries = Object.entries(obj).filter(([k, v]) =>
    !skip.includes(k) && (typeof v === 'number' || typeof v === 'string') && String(v).length < 24);
  if (!entries.length) return null;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      {entries.map(([k, v]) => (
        <div key={k} className="bg-white rounded-lg border border-slate-200 px-3 py-2">
          <div className="text-[10px] text-slate-400">{titleize(k)}</div>
          <div className="text-sm font-semibold text-slate-800">{String(v)}</div>
        </div>
      ))}
    </div>
  );
}

export default function CommandCenter() {
  const [tab, setTab] = useState('overview');
  const [rangeKey, setRangeKey] = useState('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [cc, setCc] = useState(null);
  const [csr, setCsr] = useState(null);
  const [am, setAm] = useState(null);
  const [cons, setCons] = useState(null);
  const [credit, setCredit] = useState(null);
  const [loading, setLoading] = useState(false);
  const [drill, setDrill] = useState(null);

  const [start, end] = rangeKey === 'custom'
    ? [customStart || iso(ctToday()), customEnd || iso(ctToday())]
    : rangeFor(rangeKey);

  useEffect(() => {
    setLoading(true);
    fetch(`${CC_URL}?start=${start}&end=${end}`).then((r) => r.json())
      .then((d) => { setCc(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [start, end]);
  useEffect(() => { fetch(CSR_URL).then((r) => r.json()).then(setCsr).catch(() => {}); }, []);
  useEffect(() => {
    if (tab === 'am' && !am) {
      Promise.all(Object.entries(AM_HELPERS).map(([k, u]) =>
        fetch(u).then((r) => r.json()).then((d) => [k, d]).catch(() => [k, null])
      )).then((pairs) => setAm(Object.fromEntries(pairs))).catch(() => setAm({ error: true }));
    }
    if (tab === 'consultant' && !cons) fetch(CONS_URL).then((r) => r.json()).then(setCons).catch(() => setCons({ error: true }));
    if (tab === 'credit' && !credit) fetch(CREDIT_URL).then((r) => r.json()).then(setCredit).catch(() => setCredit({ error: true }));
  }, [tab, am, cons, credit]);

  const f = cc?.funnel || {};
  const openList = (label, key) => {
    const rows = (f.lists?.[key] || []).map((d) => ({
      title: d.title,
      sub: `${d.rep || 'unclaimed'} \u00b7 ${d.pipeline}${d.stage ? ' | ' + d.stage : ''} \u00b7 created ${d.created}`,
      href: DEAL_URL(d.dealId),
    }));
    setDrill({ label: `${label} (${rows.length})`, rows });
  };

  const csrRows = csr?.csrs
    ? Object.entries(csr.csrs).map(([name, c]) => {
        const claimed = c.kpis?.newDeals || 0;
        const got = c.kpis?.claimedGotReport || 0;
        return {
          name, claimed,
          conv: claimed ? Math.round((got / claimed) * 100) : 0,
          reports: c.reports?.total || 0, idiq: c.reports?.idiq || 0,
          reachedQuoted: c.kpis?.reachedQuoted || 0, docs: c.kpis?.docFeeCollected || 0,
        };
      }).sort((a, b) => b.claimed - a.claimed)
    : [];

  const TabBtn = ({ id, label }) => (
    <button onClick={() => setTab(id)}
      className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${tab === id ? 'bg-slate-800 text-white' : 'bg-white border border-slate-300 text-slate-600 hover:border-slate-500'}`}>
      {label}
    </button>
  );

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold text-slate-800">Command Center</h1>
        <div className="flex gap-1.5 flex-wrap">
          <TabBtn id="overview" label="Overview" />
          <TabBtn id="journey" label="Journey" />
          <TabBtn id="csr" label="CSR" />
          <TabBtn id="am" label="Account Managers" />
          <TabBtn id="consultant" label="Consultants" />
          <TabBtn id="credit" label="Credit Team" />
          <TabBtn id="pipelines" label="Pipelines" />
        </div>
      </div>

      {/* RANGE PILLS (drive Overview funnel + reviews) */}
      {(tab === 'overview' || tab === 'journey') && (
        <div className="flex flex-wrap items-center gap-2">
          {[['today', 'Today'], ['yesterday', 'Yesterday'], ['week', 'Last 7 days'], ['twoweeks', 'Last 14 days'], ['month', 'This month'], ['lastmonth', 'Last month'], ['custom', 'Custom']].map(([k, lbl]) => (
            <button key={k} onClick={() => setRangeKey(k)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border ${rangeKey === k ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300 text-slate-600 hover:border-indigo-300'}`}>
              {lbl}
            </button>
          ))}
          {rangeKey === 'custom' && (
            <span className="flex items-center gap-1 text-xs">
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1 text-xs" />
              <span className="text-slate-400">to</span>
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1 text-xs" />
            </span>
          )}
          <span className="text-[11px] text-slate-400 ml-auto">{cc ? `${cc.start} to ${cc.end}` : ''}{loading ? ' \u00b7 loading\u2026' : ''}</span>
        </div>
      )}

      {/* ===== OVERVIEW ===== */}
      {tab === 'overview' && cc && (
        <>
          <div>
            <h2 className="text-sm font-semibold text-slate-600 mb-2">Deals created in range &mdash; where they are now</h2>
            <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
              <div className="flex-1 min-w-[135px]"><Stat label="Leads In" value={f.leadsIn} sub={`${f.claimed} claimed \u00b7 ${f.unclaimed} unclaimed (${f.rates?.claimRate}% claim rate)`} /></div>
              <Arrow pct={f.rates?.spokenTo ?? 0} label="spoken to" />
              <div className="flex-1 min-w-[135px]"><Stat label="Reached Reports" value={f.reachedReports} sub="moved past New Leads" accent="text-indigo-600" onClick={() => openList('Reached Reports', 'reachedReports')} /></div>
              <Arrow pct={f.rates?.reportsToQuoted ?? 0} label="to quoted" />
              <div className="flex-1 min-w-[135px]"><Stat label="Reached Quoted" value={f.reachedQuoted} accent="text-violet-600" onClick={() => openList('Reached Quoted', 'reachedQuoted')} /></div>
              <Arrow pct={f.rates?.quotedToClosed ?? 0} label="to closed" />
              <div className="flex-1 min-w-[135px]"><Stat label="Closed (Sold/CRS)" value={f.closed} sub={`overall close ${f.rates?.overallClose}% \u00b7 ${f.docFeePaid} paid doc fee`} accent="text-emerald-600" onClick={() => openList('Closed - in Sold or C.R.S.', 'closed')} /></div>
              <div className="flex-1 min-w-[135px]"><Stat label="Still in New Leads" value={f.stillNewLeads} sub="never moved out of the New Leads pipeline" accent="text-rose-600" onClick={() => openList('Still sitting in New Leads', 'stillNewLeads')} /></div>
            </div>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-600 mb-2">Reviews in range &mdash; all employees</h2>
            {(cc.reviews || []).length === 0 && <div className="text-xs text-slate-400">No reviews in this range.</div>}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {(cc.reviews || []).map((r) => (
                <div key={r.name} className="bg-white rounded-lg border border-slate-200 px-3 py-2">
                  <div className="text-[11px] text-slate-500 truncate">{r.name}</div>
                  <div className="text-lg font-bold text-slate-800">{r.count}{r.bbb > 0 && <span className="text-[10px] font-semibold text-amber-600 ml-1.5">{r.bbb} BBB</span>}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ===== JOURNEY ===== */}
      {tab === 'journey' && cc && cc.journey && (() => {
        const j = cc.journey;
        const steps = [
          ['Leads In', j.leadsIn, 'created in range'],
          ['Claimed', j.claimed, 'CSR took the lead'],
          ['Reports', j.reachedReports, 'spoken to - moved past New Leads'],
          ['Quoted', j.reachedQuoted, 'received a quote'],
          ['Closed', j.closed, 'in Sold or C.R.S.'],
          ['Doc fee', j.docFeePaid, 'first payment collected'],
          ['Round 1', j.round1Started, 'disputes started'],
          ['Round 3', j.round3Started, 'final standard round'],
          ['Round 4+', j.round4Started, 'extended disputes'],
        ];
        return (
          <div>
            <h2 className="text-sm font-semibold text-slate-600 mb-2">Full client journey &mdash; deals created in range, how far each stage reached</h2>
            <div className="space-y-1.5">
              {steps.map(([label, val, sub], i) => {
                const prev = i === 0 ? null : steps[i - 1][1];
                const p = prev ? Math.round(((val || 0) / prev) * 100) : null;
                const width = j.leadsIn ? Math.max(2, Math.round(((val || 0) / j.leadsIn) * 100)) : 2;
                return (
                  <div key={label} className="flex items-center gap-2">
                    <div className="w-24 text-xs font-medium text-slate-600 text-right shrink-0">{label}</div>
                    <div className="flex-1 bg-slate-100 rounded-full h-6 overflow-hidden">
                      <div className="h-6 rounded-full bg-indigo-500 flex items-center px-2" style={{ width: width + '%' }}>
                        <span className="text-[11px] font-bold text-white">{val}</span>
                      </div>
                    </div>
                    <div className="w-28 text-[10px] text-slate-400 shrink-0">{p != null ? p + '% of prev \u00b7 ' : ''}{sub}</div>
                  </div>
                );
              })}
            </div>
            {!j.roundsAvailable && <div className="text-[11px] text-amber-600 mt-2">Dispute-round stages show 0: the round-dates cache was not readable - flag this and we wire it.</div>}
            <div className="text-[11px] text-slate-400 mt-2">Tip: pick an older range (e.g. custom: March) to see a cohort that has had time to reach the dispute rounds. This month's cohort is naturally early-stage.</div>
          </div>
        );
      })()}

      {/* ===== CSR ===== */}
      {tab === 'csr' && (
        <div>
          <h2 className="text-sm font-semibold text-slate-600 mb-2">CSR core KPIs &mdash; this month</h2>
          {csrRows.length === 0 && <div className="text-xs text-slate-400">Loading&hellip;</div>}
          {csrRows.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="text-left font-medium px-3 py-2">CSR</th>
                    <th className="text-right font-medium px-3 py-2" title="Deals created this month with this CSR as Call Center Rep. CSRs claim deals they engage, so this counts worked leads, not the whole pool.">Claimed</th>
                    <th className="text-right font-medium px-3 py-2" title="Of the deals this CSR claimed, % with a monitoring site set. Measures quality of worked leads - the unclaimed pool is on the Overview funnel.">Conv of claimed</th>
                    <th className="text-right font-medium px-3 py-2">Reports</th>
                    <th className="text-right font-medium px-3 py-2" title="Of claimed this month, how many reached Quoted or beyond">To Quoted</th>
                    <th className="text-right font-medium px-3 py-2" title="Of claimed this month, how many paid a doc fee">Doc fees</th>
                  </tr>
                </thead>
                <tbody>
                  {csrRows.map((x) => (
                    <tr key={x.name} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-medium text-slate-800">{x.name}</td>
                      <td className="px-3 py-2 text-right">{x.claimed}</td>
                      <td className={`px-3 py-2 text-right font-semibold ${x.conv >= 50 ? 'text-emerald-600' : x.conv >= 30 ? 'text-amber-600' : x.claimed > 0 ? 'text-rose-600' : 'text-slate-300'}`}>{x.claimed ? x.conv + '%' : '-'}</td>
                      <td className="px-3 py-2 text-right">{x.reports} <span className="text-[10px] text-slate-400">({x.idiq} IDIQ)</span></td>
                      <td className="px-3 py-2 text-right">{x.reachedQuoted}</td>
                      <td className="px-3 py-2 text-right">{x.docs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===== AM ===== */}
      {tab === 'am' && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-600">Account Manager KPIs &mdash; this month</h2>
          {!am && <div className="text-xs text-slate-400">Loading&hellip;</div>}
          {am && (() => {
            const names = new Set();
            const val = (o, n) => { const e = o?.byAM?.[n]; if (e == null) return null; return typeof e === 'object' ? (e.value ?? e.score ?? e.count ?? e.total ?? JSON.stringify(e)) : e; };
            Object.keys(am.csat?.byAM || {}).forEach((n) => names.add(n));
            Object.keys(am.referrals?.byAM || {}).forEach((n) => names.add(n));
            Object.keys(am.rounds?.byAM || {}).forEach((n) => names.add(n));
            const stallArr = Array.isArray(am.stall?.accountManagers) ? am.stall.accountManagers : [];
            stallArr.forEach((x) => { const n = x.name || x.am || x.accountManager; if (n) names.add(n); });
            const stallFor = (n) => {
              const x = stallArr.find((e) => (e.name || e.am || e.accountManager) === n);
              if (!x) return null;
              return x.stallRate ?? x.stall_pct ?? x.pct ?? (x.stalled != null && x.evaluated ? Math.round((x.stalled / x.evaluated) * 100) : x.stalled ?? null);
            };
            const rows = [...names].map((n) => ({
              name: n, csat: val(am.csat, n), referrals: val(am.referrals, n),
              stall: stallFor(n), ars: val(am.rounds, n),
            }));
            return rows.length === 0 ? <div className="text-xs text-slate-400">No AM data returned.</div> : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500"><tr>
                    <th className="text-left font-medium px-3 py-2">Account Manager</th>
                    <th className="text-right font-medium px-3 py-2" title="CSAT survey average this month">CSAT</th>
                    <th className="text-right font-medium px-3 py-2">Referrals</th>
                    <th className="text-right font-medium px-3 py-2" title="% of active clients stalled">Stall</th>
                    <th className="text-right font-medium px-3 py-2" title="Additional rounds paid this month">ARs</th>
                  </tr></thead>
                  <tbody>
                    {rows.map((x) => (
                      <tr key={x.name} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-medium text-slate-800">{x.name}</td>
                        <td className="px-3 py-2 text-right">{x.csat ?? '-'}</td>
                        <td className="px-3 py-2 text-right">{x.referrals ?? '-'}</td>
                        <td className="px-3 py-2 text-right">{x.stall != null ? x.stall + '%' : '-'}</td>
                        <td className="px-3 py-2 text-right">{x.ars ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {am.rounds?.pastDueRounds != null && <div className="px-3 py-2 text-[11px] text-rose-600 border-t border-slate-100">Past-due additional rounds: {Array.isArray(am.rounds.pastDueRounds) ? am.rounds.pastDueRounds.length : am.rounds.pastDueRounds}</div>}
              </div>
            );
          })()}
        </div>
      )}

      {/* ===== CONSULTANT ===== */}
      {tab === 'consultant' && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-600">Consultant KPIs &mdash; this month</h2>
          {!cons && <div className="text-xs text-slate-400">Loading&hellip;</div>}
          {cons && (() => {
            const list = Array.isArray(cons.consultants) ? cons.consultants
              : cons.consultants && typeof cons.consultants === 'object'
                ? Object.entries(cons.consultants).map(([n, v]) => ({ name: n, ...(typeof v === 'object' ? v : {}) }))
                : [];
            if (!list.length) return <div className="text-xs text-slate-400">No consultant data returned.</div>;
            const pick = (c, keys) => { for (const k of keys) { if (c[k] != null && typeof c[k] !== 'object') return c[k]; } return null; };
            const rows = list.map((c) => ({
              name: c.name || 'Unknown',
              sales: pick(c, ['totalSales', 'mtdSales', 'sales']),
              docs: pick(c, ['qualifiedDocs', 'docs', 'docFees', 'mtdDocs', 'totalDocs']),
              todaySales: c.today && typeof c.today === 'object' ? (c.today.sales ?? null) : null,
              closing: pick(c, ['closingRate', 'conversion', 'closeRate']),
            }));
            return (
              <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500"><tr>
                    <th className="text-left font-medium px-3 py-2">Consultant</th>
                    <th className="text-right font-medium px-3 py-2">Sales (MTD)</th>
                    <th className="text-right font-medium px-3 py-2">Today</th>
                    <th className="text-right font-medium px-3 py-2">Qualified docs</th>
                    <th className="text-right font-medium px-3 py-2">Closing</th>
                  </tr></thead>
                  <tbody>
                    {rows.sort((a, b) => (b.sales || 0) - (a.sales || 0)).map((x) => (
                      <tr key={x.name} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-medium text-slate-800">{x.name}</td>
                        <td className="px-3 py-2 text-right">{x.sales != null ? '$' + Number(x.sales).toLocaleString() : '-'}</td>
                        <td className="px-3 py-2 text-right">{x.todaySales != null ? '$' + Number(x.todaySales).toLocaleString() : '-'}</td>
                        <td className="px-3 py-2 text-right">{x.docs ?? '-'}</td>
                        <td className="px-3 py-2 text-right">{x.closing != null ? x.closing + '%' : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      )}

      {/* ===== CREDIT ===== */}
      {tab === 'credit' && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-600">Credit Team KPIs &mdash; this month</h2>
          {!credit && <div className="text-xs text-slate-400">Loading&hellip;</div>}
          {credit?.metrics && Object.entries(credit.metrics).map(([k, m]) => (
            <div key={k}
              onClick={() => {
                const cl = m.detail?.clients || [];
                setDrill({ label: `${titleize(k)} - detail (${cl.length})`, rows: cl.map((c) => ({
                  title: c.name || 'Unknown',
                  sub: [c.bucket, c.removed != null ? (c.removed ? 'removed items' : 'nothing removed') : null, c.days != null ? `${c.days} days` : null].filter(Boolean).join(' \u00b7 '),
                  href: c.dealId ? DEAL_URL(c.dealId) : null,
                })) });
              }}
              className={`bg-white rounded-lg border px-3 py-2 flex items-center justify-between cursor-pointer hover:border-indigo-300 ${m.met ? 'border-slate-200' : 'border-rose-300'}`}>
              <div className="text-sm text-slate-700">{titleize(k)}</div>
              <div className={`text-sm font-bold ${m.met ? 'text-emerald-600' : 'text-rose-600'}`}>
                {m.value}{m.unit}<span className="text-[10px] text-slate-400 font-normal ml-1.5">std {m.standard}{m.unit}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ===== PIPELINES ===== */}
      {tab === 'pipelines' && cc && (
        <div>
          <h2 className="text-sm font-semibold text-slate-600 mb-2">Live Pipeline Census &mdash; {cc.censusTotalOpen} open deals right now</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {(cc.census || []).map((p) => (
              <details key={p.pipeline} className="bg-white rounded-xl border border-slate-200 p-3">
                <summary className="cursor-pointer flex justify-between text-sm">
                  <span className="font-medium text-slate-700 truncate pr-2">{p.pipeline}</span>
                  <span className="font-bold text-slate-800">{p.total}</span>
                </summary>
                <div className="mt-2 space-y-0.5">
                  {p.stages.map((s) => (
                    <div key={s.stage} className="flex justify-between text-xs text-slate-500">
                      <span className="truncate pr-2">{s.stage}</span><span>{s.count}</span>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </div>
      )}

      {/* DRILL MODAL */}
      {drill && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setDrill(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[70vh] overflow-y-auto p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-2">
              <div className="font-semibold text-slate-800 text-sm">{drill.label}</div>
              <button className="text-slate-400 hover:text-slate-700 text-lg leading-none" onClick={() => setDrill(null)}>&times;</button>
            </div>
            <div className="space-y-1">
              {drill.rows.map((r, i) => (
                <a key={i} href={r.href} target="_blank" rel="noreferrer" className="block border border-slate-100 rounded-lg px-3 py-1.5 hover:border-indigo-300">
                  <div className="text-sm text-slate-800">{r.title}</div>
                  <div className="text-[11px] text-slate-400">{r.sub}</div>
                </a>
              ))}
              {drill.rows.length === 0 && <div className="text-xs text-slate-400">Nothing here.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
