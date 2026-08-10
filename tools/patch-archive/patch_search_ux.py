import sys
f = 'src/pages/ClientFile.jsx'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
open_anchor = """      <div className="relative mb-6">
        <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />"""
if s.count(open_anchor) != 1: print(f"ABORTED: open anchor x{s.count(open_anchor)}"); sys.exit(1)
s = s.replace(open_anchor, """      {!client && (
      <div className="relative mb-6">
        <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />""", 1)
close_anchor = """        )}
      </div>
      {loading && <div className="flex items-center gap-2 text-gray-500">"""
if s.count(close_anchor) != 1: print(f"ABORTED: close anchor x{s.count(close_anchor)}"); sys.exit(1)
s = s.replace(close_anchor, """        )}
      </div>
      )}
      {client && !loading && (
        <button onClick={() => { setClient(null); setQuery(''); setResults([]); }}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-blue-600 font-medium hover:underline">
          <Search className="w-4 h-4" /> New search
        </button>
      )}
      {loading && <div className="flex items-center gap-2 text-gray-500">""", 1)
row_anchor = """                <div className="text-xs text-gray-500">{r.email || 'no email'} {r.phone ? `- ${r.phone}` : ''} {r.account_manager_name ? `- AM: ${r.account_manager_name}` : ''}</div>"""
if s.count(row_anchor) != 1: print(f"ABORTED: row anchor x{s.count(row_anchor)}"); sys.exit(1)
s = s.replace(row_anchor, row_anchor + """
                <div className="text-xs mt-0.5 flex flex-wrap gap-1.5">
                  {opt('current_status', r.current_status) && <span className="bg-green-50 text-green-700 px-1.5 py-0.5 rounded">{opt('current_status', r.current_status)}</span>}
                  {r.latest_stage && <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{r.latest_stage}</span>}
                  {r.latest_deal_status && <span className={`px-1.5 py-0.5 rounded ${r.latest_deal_status === 'won' ? 'bg-emerald-50 text-emerald-700' : r.latest_deal_status === 'lost' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-700'}`}>{r.latest_deal_status}</span>}
                </div>""", 1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
print("ClientFile: search collapses on open + result rows show status/stage/deal-status")
