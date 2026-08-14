import sys
f = 'src/pages/Invoices.jsx'
s = open(f, encoding='utf-8', errors='surrogateescape').read()

# ---- 1) DealView: accept qualifiedDoc prop, render the badge after doc_fee block ----
a1 = "function DealView({ data, isAdmin, canRequest, onAction, pendingByCharge = {} }) {"
if s.count(a1) != 1: print("ABORTED: DealView signature anchor x" + str(s.count(a1))); sys.exit(1)
s = s.replace(a1, "function DealView({ data, isAdmin, canRequest, onAction, pendingByCharge = {}, qualifiedDoc }) {", 1)

a2 = """        )
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <h3 className="text-base font-semibold text-asap-blue">Client Information</h3>"""
if s.count(a2) != 1: print("ABORTED: insert-point anchor x" + str(s.count(a2))); sys.exit(1)
badge = """        )
      )}

      {qualifiedDoc && (
        qualifiedDoc.qualified ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-green-200 bg-green-50 text-xs text-green-800">
            <CheckCircle2 size={14} className="text-green-600 shrink-0" />
            <span className="font-semibold">Qualified Doc</span>
            {qualifiedDoc.month && <span className="text-green-600">(counts in {qualifiedDoc.month})</span>}
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-800">
            <AlertTriangle size={14} className="text-amber-600 shrink-0" />
            <span className="font-semibold">Not a Qualified Doc</span>
            {qualifiedDoc.reason && <span className="text-amber-700">— {qualifiedDoc.reason}</span>}
          </div>
        )
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <h3 className="text-base font-semibold text-asap-blue">Client Information</h3>"""
s = s.replace(a2, badge, 1)
print("badge added to DealView")

# ---- 2) lookup(): fetch check_qualified_doc in parallel, store in state ----
a3 = "const [dealData, setDealData] = useState(null);"
if s.count(a3) != 1: print("ABORTED: state anchor x" + str(s.count(a3))); sys.exit(1)
s = s.replace(a3, a3 + "\n  const [qualifiedDoc, setQualifiedDoc] = useState(null);", 1)

a4 = """      const [data] = await Promise.all([callApi('get_deal', { deal_id: id }), loadPendingApprovals()]);
      setDealData(data);"""
if s.count(a4) != 1: print("ABORTED: lookup anchor x" + str(s.count(a4))); sys.exit(1)
s = s.replace(a4, """      const [data] = await Promise.all([callApi('get_deal', { deal_id: id }), loadPendingApprovals()]);
      setDealData(data);
      callApi('check_qualified_doc', { deal_id: id }).then(setQualifiedDoc).catch(() => setQualifiedDoc(null));""", 1)
print("lookup() fires check_qualified_doc in parallel")

# ---- 3) reset qualifiedDoc alongside dealData ----
a5 = "setLoading(true); setErr(null); setDealData(null); setMode('browse');"
if s.count(a5) != 1: print("ABORTED: reset anchor x" + str(s.count(a5))); sys.exit(1)
s = s.replace(a5, "setLoading(true); setErr(null); setDealData(null); setQualifiedDoc(null); setMode('browse');", 1)
print("reset includes qualifiedDoc")

# ---- 4) pass qualifiedDoc down to DealView ----
a6 = "<DealView data={dealData} isAdmin={isAdmin} canRequest={canRequest} onAction={openAction} pendingByCharge"
matches6 = s.count(a6)
if matches6 == 0: print("ABORTED: DealView call-site anchor x0"); sys.exit(1)
# find the full line to append the prop right before the closing tag's />
import re
m = re.search(re.escape(a6) + r'[^\n]*', s)
if not m: print("ABORTED: could not isolate full DealView call-site line"); sys.exit(1)
line = m.group(0)
if 'qualifiedDoc=' in line: print("ABORTED: qualifiedDoc already on this line"); sys.exit(1)
new_line = line.rstrip()
if new_line.endswith('/>'):
    new_line = new_line[:-2].rstrip() + ' qualifiedDoc={qualifiedDoc} />'
else:
    print("ABORTED: DealView call-site line doesn't end in /> as expected: " + line[-30:]); sys.exit(1)
s = s.replace(line, new_line, 1)
print("qualifiedDoc passed to DealView call site")

open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
