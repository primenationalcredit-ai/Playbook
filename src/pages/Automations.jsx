import React, { useState, useEffect, useCallback } from 'react';
import { Zap, RefreshCw } from 'lucide-react';

// AUTOMATIONS (Phase 1, Joe 8/6) - the honest map of everything automated.
// Registry rows with ON/OFF toggles (only where toggle_live - greyed switches
// would be lies), run feed underneath. Data: automation_registry +
// automation_runs, written by the payment processor's automation-log helper.
const SUPABASE_URL = 'https://kkcbpqbcpzcarxhknzza.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0';
const H = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

function Automations() {
  const [autos, setAutos] = useState([]);
  const [runs, setRuns] = useState([]);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(null);
  const [conns, setConns] = useState([]);
  const load = useCallback(async () => {
    try {
      const [a, r] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/automation_registry?select=*&order=name.asc`, { headers: H }).then((x) => x.json()),
        fetch(`${SUPABASE_URL}/rest/v1/automation_runs?select=*&order=ran_at.desc&limit=50`, { headers: H }).then((x) => x.json()),
      ]);
      setAutos(Array.isArray(a) ? a : []);
      setRuns(Array.isArray(r) ? r : []);
      fetch('/.netlify/functions/connections-proxy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"action":"list"}' })
        .then((x) => x.json()).then((d) => setConns(Array.isArray(d.connections) ? d.connections : [])).catch(() => {});
      setErr(null);
    } catch (e) { setErr(String(e)); }
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);
  const toggle = async (auto) => {
    if (!auto.toggle_live || busy) return;
    setBusy(auto.id);
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/automation_registry?id=eq.${encodeURIComponent(auto.id)}`, {
        method: 'PATCH', headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ enabled: !auto.enabled, updated_at: new Date().toISOString() }),
      });
      setAutos((prev) => prev.map((x) => (x.id === auto.id ? { ...x, enabled: !auto.enabled } : x)));
    } catch (e) { alert('Toggle failed: ' + e); }
    setBusy(null);
  };
  const runColor = (s) => (s === 'success' ? 'text-emerald-700 bg-emerald-50' : s === 'alert' ? 'text-amber-700 bg-amber-50' : 'text-rose-700 bg-rose-50');
  const nameOf = (id) => (autos.find((a) => a.id === id) || {}).name || id;
  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center gap-2">
        <Zap className="w-6 h-6 text-indigo-600" />
        <h1 className="text-xl font-bold text-slate-800">Automations</h1>
        <button onClick={load} className="ml-auto p-2 rounded-lg border border-slate-300 text-slate-500 hover:bg-slate-50"><RefreshCw className="w-4 h-4" /></button>
      </div>
      {err && <div className="text-xs text-rose-700 bg-rose-50 rounded-lg p-3">{err}</div>}
      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        {autos.map((a) => (
          <div key={a.id} className="p-4 flex items-start gap-4">
            <button onClick={() => toggle(a)} disabled={!a.toggle_live || busy === a.id}
              title={a.toggle_live ? 'Turn this automation on/off' : 'Display only - switch not wired yet'}
              className={`mt-1 w-11 h-6 rounded-full relative transition-colors flex-shrink-0 ${a.enabled ? 'bg-emerald-500' : 'bg-slate-300'} ${a.toggle_live ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'}`}>
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${a.enabled ? 'left-5' : 'left-0.5'}`} />
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-800 text-sm">{a.name}</span>
                {a.runs_in === 'zapier' && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">RUNS IN ZAPIER</span>}
                {!a.toggle_live && a.runs_in !== 'zapier' && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">SWITCH COMING</span>}
              </div>
              <p className="text-xs text-slate-600 mt-0.5">{a.description}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Trigger: {a.trigger_desc}</p>
            </div>
          </div>
        ))}
        {!autos.length && !err && <div className="p-6 text-sm text-slate-400">Loading registry\u2026</div>}
      </div>
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-2">Connections</h2>
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
          {conns.map((c) => (
            <div key={c.name} className="px-4 py-2.5 flex items-center gap-3 text-xs flex-wrap">
              <span className="font-semibold text-slate-800">{c.name}</span>
              {c.service && <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-medium">{c.service}</span>}
              <span className="text-slate-400 ml-auto">added {new Date(c.created_at).toLocaleDateString()}</span>
              <span className="text-slate-400">{c.last_used_at ? `last used ${new Date(c.last_used_at).toLocaleString()}` : 'not used yet'}</span>
            </div>
          ))}
          {!conns.length && <div className="p-4 text-xs text-slate-400">No connections stored yet.</div>}
        </div>
        <p className="text-[11px] text-slate-400 mt-1.5">Credentials are encrypted in the vault — values never appear here and can’t be viewed from this page. Adding or removing a connection goes through the gated admin door.</p>
      </div>
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-2">Recent runs (auto-refreshes)</h2>
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
          {runs.map((r) => (
            <div key={r.id} className="px-4 py-2.5 flex items-center gap-3 text-xs">
              <span className={`px-1.5 py-0.5 rounded font-semibold ${runColor(r.status)}`}>{r.status}</span>
              <span className="text-slate-400 whitespace-nowrap">{new Date(r.ran_at).toLocaleString()}</span>
              <span className="font-medium text-slate-700 whitespace-nowrap">{nameOf(r.automation_id)}</span>
              <span className="text-slate-600 truncate">{r.subject}{r.detail ? ` \u2014 ${r.detail}` : ''}</span>
            </div>
          ))}
          {!runs.length && <div className="p-6 text-sm text-slate-400">No runs logged yet \u2014 the next automated payment writes the first line.</div>}
        </div>
      </div>
    </div>
  );
}
export default Automations;
