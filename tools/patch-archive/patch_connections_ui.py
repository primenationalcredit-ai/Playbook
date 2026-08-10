import sys
f = 'src/pages/Automations.jsx'
s = open(f, encoding='utf-8').read()

old = "  const [busy, setBusy] = useState(null);"
new = "  const [busy, setBusy] = useState(null);\n  const [conns, setConns] = useState([]);"
if s.count(old) != 1: print(f"ABORTED: state anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)

old = "      setRuns(Array.isArray(r) ? r : []);"
new = """      setRuns(Array.isArray(r) ? r : []);
      fetch('/.netlify/functions/connections-proxy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"action":"list"}' })
        .then((x) => x.json()).then((d) => setConns(Array.isArray(d.connections) ? d.connections : [])).catch(() => {});"""
if s.count(old) != 1: print(f"ABORTED: load anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)

old = """      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-2">Recent runs (auto-refreshes)</h2>"""
new = """      <div>
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
        <p className="text-[11px] text-slate-400 mt-1.5">Credentials are encrypted in the vault \u2014 values never appear here and can\u2019t be viewed from this page. Adding or removing a connection goes through the gated admin door.</p>
      </div>
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-2">Recent runs (auto-refreshes)</h2>"""
if s.count(old) != 1: print(f"ABORTED: render anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("Connections section wired into the Automations page")
