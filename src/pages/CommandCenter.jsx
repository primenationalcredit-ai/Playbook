import { useEffect, useState } from 'react';

// COMMAND CENTER P1 - funnel + census + CSR panel.
// AM / Consultant / Credit panels + Red Board land in P2.

const CC_URL = '/.netlify/functions/admin-command-center';
const CSR_URL = '/.netlify/functions/csr-bonus-metrics';
const DEAL_URL = (id) => `https://asapcreditrepair.pipedrive.com/deal/${id}`;

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
  const [cc, setCc] = useState(null);
  const [csr, setCsr] = useState(null);
  const [err, setErr] = useState(null);
  const [drill, setDrill] = useState(null); // { label, rows: [{title, sub, href}] }

  useEffect(() => {
    fetch(CC_URL).then((r) => r.json()).then(setCc).catch((e) => setErr(String(e)));
    fetch(CSR_URL).then((r) => r.json()).then(setCsr).catch(() => {});
  }, []);

  if (err) return <div className="p-6 text-rose-600 text-sm">Command Center failed to load: {err}</div>;
  if (!cc) return <div className="p-6 text-slate-400 text-sm">Loading Command Center&hellip;</div>;
  const f = cc.funnel || {};
  const openList = (label, key) => {
    const rows = (f.lists?.[key] || []).map((d) => ({
      title: d.title, sub: `${d.rep || 'unclaimed'} \u00b7 ${d.pipeline}${d.stage ? ' | ' + d.stage : ''} \u00b7 created ${d.created}`,
      href: DEAL_URL(d.dealId),
    }));
    setDrill({ label: `${label} (${rows.length})`, rows });
  };

  const csrRows = csr?.csrs
    ? Object.entries(csr.csrs).map(([name, c]) => {
        const claimed = c.kpis?.newDeals || 0;
        const got = c.kpis?.claimedGotReport || 0;
        const conv = claimed ? Math.round((got / claimed) * 100) : 0;
        const bonus = (c.reportBonus?.bonus || 0) + (c.conversionBonus?.bonus || 0) + (c.reviewBonus?.bonus || 0);
        return {
          name, claimed, got, conv,
          reports: c.reports?.total || 0, idiq: c.reports?.idiq || 0,
          rq: c.closingRate ?? 0, docs: c.kpis?.docFeeCollected || 0, bonus,
        };
      }).sort((a, b) => b.reports - a.reports)
    : [];

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold text-slate-800">Command Center</h1>
        <span className="text-xs text-slate-400">{cc.month} &middot; refreshed {String(cc.generatedAt || '').slice(11, 16)} UTC{cc.cached ? ' (cached)' : ''}</span>
      </div>

      {/* ZONE 1: FUNNEL */}
      <div>
        <h2 className="text-sm font-semibold text-slate-600 mb-2">This Month&rsquo;s Funnel &mdash; deals created in {cc.month}</h2>
        <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
          <div className="flex-1 min-w-[130px]"><Stat label="Leads In" value={f.leadsIn} sub={`${f.claimed} claimed \u00b7 ${f.unclaimed} unclaimed (${f.rates?.claimRate}% claim rate)`} accent="text-slate-800" /></div>
          <Arrow pct={f.rates?.spokenTo ?? 0} label="spoken to" />
          <div className="flex-1 min-w-[130px]"><Stat label="Reached Reports" value={f.reachedReports} sub="moved out of New Leads" accent="text-indigo-600" onClick={() => openList('Reached Reports', 'reachedReports')} /></div>
          <Arrow pct={f.rates?.reportsToQuoted ?? 0} label="to quoted" />
          <div className="flex-1 min-w-[130px]"><Stat label="Reached Quoted" value={f.reachedQuoted} accent="text-violet-600" onClick={() => openList('Reached Quoted', 'reachedQuoted')} /></div>
          <Arrow pct={f.rates?.quotedToSold ?? 0} label="to sold" />
          <div className="flex-1 min-w-[130px]"><Stat label="Sold (doc fee)" value={f.soldDocFee} sub={`overall close ${f.rates?.overallClose}%`} accent="text-emerald-600" onClick={() => openList('Sold with doc fee', 'soldDocFee')} /></div>
          <div className="flex-1 min-w-[130px]"><Stat label="Still in New Leads" value={f.stillNewLeads} sub="untouched" accent="text-rose-600" onClick={() => openList('Still in New Leads', 'stillNewLeads')} /></div>
        </div>
      </div>

      {/* ZONE 3: CENSUS */}
      <div>
        <h2 className="text-sm font-semibold text-slate-600 mb-2">Live Pipeline Census &mdash; {cc.censusTotalOpen} open deals</h2>
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

      {/* ZONE 4 (P1: CSR only) */}
      <div>
        <h2 className="text-sm font-semibold text-slate-600 mb-2">CSR Department {csr ? '' : '\u2014 loading\u2026'}</h2>
        {csrRows.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="text-left font-medium px-3 py-2">CSR</th>
                  <th className="text-right font-medium px-3 py-2">Claimed</th>
                  <th className="text-right font-medium px-3 py-2" title="Of claimed this month, % with a monitoring site set">Conv</th>
                  <th className="text-right font-medium px-3 py-2">Reports</th>
                  <th className="text-right font-medium px-3 py-2">Doc fees</th>
                  <th className="text-right font-medium px-3 py-2">Bonus (mo)</th>
                </tr>
              </thead>
              <tbody>
                {csrRows.map((x) => (
                  <tr key={x.name} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-800">{x.name}</td>
                    <td className="px-3 py-2 text-right">{x.claimed}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${x.conv >= 50 ? 'text-emerald-600' : x.conv >= 30 ? 'text-amber-600' : x.claimed > 0 ? 'text-rose-600' : 'text-slate-300'}`}>{x.claimed ? x.conv + '%' : '-'}</td>
                    <td className="px-3 py-2 text-right">{x.reports} <span className="text-[10px] text-slate-400">({x.idiq} IDIQ)</span></td>
                    <td className="px-3 py-2 text-right">{x.docs}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${x.bonus > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>${x.bonus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="text-[11px] text-slate-400 mt-2">AM / Consultant / Credit panels + Red Board + Sold Touch Time arrive in Phase 2. Lead sources (top organizations) in Phase 3.</div>
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
