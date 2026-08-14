import sys
f = 'src/pages/Invoices.jsx'
s = open(f, encoding='utf-8', errors='surrogateescape').read()

a1 = "function DealView({ data, isAdmin, canRequest, onAction, pendingByCharge = {} }) {"
if s.count(a1) != 1: print("ABORTED step1: x" + str(s.count(a1))); sys.exit(1)
s = s.replace(a1, "function DealView({ data, isAdmin, canRequest, onAction, pendingByCharge = {}, qualifiedDoc }) {", 1)
print("step1 ok: DealView signature")

a2 = """        )
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <h3 className="text-base font-semibold text-asap-blue">Client Information</h3>"""
if s.count(a2) != 1: print("ABORTED step2: x" + str(s.count(a2))); sys.exit(1)
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
print("step2 ok: badge JSX")

a3 = "const [dealData, setDealData] = useState(null);"
if s.count(a3) != 1: print("ABORTED step3: x" + str(s.count(a3))); sys.exit(1)
s = s.replace(a3, a3 + "\n  const [qualifiedDoc, setQualifiedDoc] = useState(null);", 1)
print("step3 ok: state decl")

a4 = """      const [data] = await Promise.all([callApi('get_deal', { deal_id: id }), loadPendingApprovals()]);
      setDealData(data);"""
if s.count(a4) != 1: print("ABORTED step4: x" + str(s.count(a4))); sys.exit(1)
s = s.replace(a4, """      const [data] = await Promise.all([callApi('get_deal', { deal_id: id }), loadPendingApprovals()]);
      setDealData(data);
      callApi('check_qualified_doc', { deal_id: id }).then(setQualifiedDoc).catch(() => setQualifiedDoc(null));""", 1)
print("step4 ok: lookup fires check_qualified_doc")

a5 = "setLoading(true); setErr(null); setDealData(null); setMode('browse');"
if s.count(a5) != 1: print("ABORTED step5: x" + str(s.count(a5))); sys.exit(1)
s = s.replace(a5, "setLoading(true); setErr(null); setDealData(null); setQualifiedDoc(null); setMode('browse');", 1)
print("step5 ok: reset wiring")

open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
print("FILE WRITTEN - all 5 steps applied")
