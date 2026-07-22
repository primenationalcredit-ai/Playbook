import { useEffect, useState } from 'react';

// COMMAND CENTER P1.1 - date-range funnel + census + CSR metrics (no bonus $).
// Cohort = deals CREATED in the selected range; funnel = where they are NOW.

const CC_URL = '/.netlify/functions/admin-command-center';
const CSR_URL = '/.netlify/functions/csr-bonus-metrics';
const DEAL_URL = (id) => `https://asapcreditrepair.pipedrive.com/deal/${id}`;

const ctToday = () => {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  return d;
};
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

export default function CommandCenter() {
  const [rangeKey, setRangeKey] = useState('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [cc, setCc] = useState(null);
  const [csr, setCsr] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);
  const [drill, setDrill] = useState(null);

  const [start, end] = rangeKey === 'custom'
    ? [customStart || iso(ctToday()), customEnd || iso(ctToday())]
    : rangeFor(rangeKey);

  useEffect(() => {
    setLoading(true);
    fetch(`${CC_URL}?start=${start}&end=${end}`)
      .then((r) => r.json()).then((d) => { setCc(d); setLoading(false); })
      .catch((e) => { setErr(String(e)); setLoading(false); });
  }, [start, end]);
  useEffect(() => { fetch(CSR_URL).then((r) => r.json()).then(setCsr).catch(() => {}); }, []);

  if (err) return <div className="p-6 text-rose-600 text-sm">Command Center failed to load: {err}</div>;
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
          reachedQuoted: c.kpis?.reachedQuoted || 0,
          docs: c.kpis?.docFeeCollected || 0,
        };
      }).sort((a, b) => b.claimed - a.claimed)
    : [];

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold text-slate-800">Command Center</h1>
        <span className="text-xs text-slate-400">{cc ? `${cc.start} to ${cc.end}` : ''}{cc?.cached ? ' (cached)' : ''}{loading ? ' \u00b7 loading\u2026' : ''}</span>
      </div>

      {/* RANGE PILLS */}
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
      </div>

      {/* FUNNEL: deals created in range -> where they landed */}
      {cc && (
        <div>
          <h2 className="text-sm font-semibold text-slate-600 mb-2">Deals created {cc.start === cc.end ? cc.start : `${cc.start} to ${cc.end}`} &mdash; where they are now</h2>
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
      )}

      {/* CENSUS */}
      {cc && (
        <div>
          <h2 className="text-sm font-semibold text-slate-600 mb-2">Live Pipeline Census &mdash; {cc.censusTotalOpen} open deals right now (not range-filtered)</h2>
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

      {/* CSR METRICS (month-scoped; no bonus $) */}
      <div>
        <h2 className="text-sm font-semibold text-slate-600 mb-2">CSR Department &mdash; this month {csr ? '' : '(loading\u2026)'}</h2>
        {csrRows.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="text-left font-medium px-3 py-2">CSR</th>
                  <th className="text-right font-medium px-3 py-2" title="Deals created this month with this CSR as Call Center Rep">Claimed</th>
                  <th className="text-right font-medium px-3 py-2" title="Of claimed, % with a monitoring site set">Conv</th>
                  <th className="text-right font-medium px-3 py-2">Reports</th>
                  <th className="text-right font-medium px-3 py-2" title="Of claimed this month, how many reached Quoted">To Quoted</th>
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
        <div className="text-[11px] text-slate-400 mt-2">Phase 2: AM / Consultant / Credit panels, Red Board, Sold touch time. Phase 3: lead sources by organization.</div>
      </div>

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
