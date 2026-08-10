# AffiliateOutreach.jsx: (1) called-today chip on each book row, (2) "Not called
# today" filter, (3) Referred Clients history modal (affiliate-referred-deals fn).
import sys, re
f = 'src/pages/AffiliateOutreach.jsx'
s = open(f, encoding='utf-8').read()
fails = []

# ---- 1. state + effect + loader, after viewTouch state ----
oldA = "  const [viewTouch, setViewTouch] = useState(null);"
newA = oldA + """
  const [calledToday, setCalledToday] = useState({});
  const [notCalledOnly, setNotCalledOnly] = useState(false);
  const [refOpen, setRefOpen] = useState(null);
  const [refData, setRefData] = useState({});
  useEffect(() => {
    (async () => {
      try {
        const start = new Date(); start.setHours(0, 0, 0, 0);
        const t = await sbGet(`affiliate_touches?channel=eq.call&created_at=gte.${start.toISOString()}&select=affiliate_org_id,subject,detail,created_at&order=created_at.desc&limit=500`);
        const m = {};
        for (const x of (Array.isArray(t) ? t : [])) if (!m[x.affiliate_org_id]) m[x.affiliate_org_id] = x;
        setCalledToday(m);
      } catch (e) {}
    })();
  }, []);
  const openReferred = async (a) => {
    setRefOpen(a.id);
    if (refData[a.id]) return;
    try {
      const r = await fetch(`/.netlify/functions/affiliate-referred-deals?id=${a.id}`);
      const d = await r.json();
      setRefData((p) => ({ ...p, [a.id]: d }));
    } catch (e) { setRefData((p) => ({ ...p, [a.id]: { error: 'load failed' } })); }
  };"""
if s.count(oldA) != 1: fails.append(f"state anchor x{s.count(oldA)}")
else: s = s.replace(oldA, newA, 1); print("OK 1: state + called-today loader + history loader")

# ---- 2. chip under name/email ----
oldB = "                          <div className=\"text-xs text-gray-400\">{a.contact_email || 'no email'}{a.contact_phone ? ` \u00b7 ${a.contact_phone}` : ''}</div>"
newB = oldB + """
                          {calledToday[a.id]
                            ? <span className="inline-block mt-1 text-[11px] px-2 py-0.5 rounded-full bg-green-100 text-green-700" title={calledToday[a.id].detail || ''}>{'\\u2713'} called today{calledToday[a.id].subject ? ` \u00b7 ${calledToday[a.id].subject}` : ''}</span>
                            : (!a.opted_out && <span className="inline-block mt-1 text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">not called today</span>)}"""
if s.count(oldB) != 1:
    fails.append(f"chip anchor x{s.count(oldB)}")
    for i, ln in enumerate(s.split('\n'), 1):
        if 'no email' in ln: print(f"  cand {i}: {repr(ln[:140])}")
else: s = s.replace(oldB, newB, 1); print("OK 2: called-today chip")

# ---- 3. filter wiring on rows.map ----
oldC = "                  {rows.map((a) => ("
newC = "                  {rows.filter((a) => !notCalledOnly || (!calledToday[a.id] && !a.opted_out)).map((a) => ("
if s.count(oldC) != 1: fails.append(f"rows.map anchor x{s.count(oldC)}")
else: s = s.replace(oldC, newC, 1); print("OK 3: not-called filter wired")

# ---- 4. toolbar toggle button after the search input ----
# input tag spans lines; anchor on its unique closing line, prefer inserting
# after the wrapper </div> so the button sits beside the search box.
mD = re.search(r'placeholder="Search name or email"[^\n]*/>\s*\n\s*</div>', s)
if not mD:
    mD = re.search(r'placeholder="Search name or email"[^\n]*/>', s)
if not mD:
    fails.append("search input not found")
    for i, ln in enumerate(s.split('\n'), 1):
        if 'placeholder=' in ln: print(f"  cand {i}: {ln.strip()[:130]}")
else:
    btn = ("\n                <button onClick={() => setNotCalledOnly((v) => !v)}"
           "\n                  className={`text-xs px-3 py-1.5 rounded-lg border font-medium whitespace-nowrap ${notCalledOnly ? 'bg-amber-100 border-amber-300 text-amber-800' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>"
           "\n                  Not called today ({rows.filter((x) => !calledToday[x.id] && !x.opted_out).length})"
           "\n                </button>")
    s = s[:mD.end()] + btn + s[mD.end():]
    print("OK 4: toolbar filter button")

# ---- 5. history button + modal in the actions cell ----
oldE = """                          <button onClick={() => toggleExpand(a)} className="p-1.5 rounded hover:bg-gray-200">
                            {expanded === a.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>"""
newE = """                          <button onClick={() => openReferred(a)} title="Referred clients history" className="p-1.5 rounded hover:bg-gray-200 mr-1">
                            <Users className="w-4 h-4 text-blue-600" />
                          </button>
""" + oldE + """
                          {refOpen === a.id && (
                            <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setRefOpen(null)}>
                              <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col text-left" onClick={(e) => e.stopPropagation()}>
                                <div className="px-5 py-4 border-b flex items-center justify-between">
                                  <div>
                                    <div className="font-bold text-lg">{a.org_name}</div>
                                    <div className="text-xs text-gray-500">Referred clients {'\\u00b7'} pulled live from Pipedrive</div>
                                  </div>
                                  <button onClick={() => setRefOpen(null)} className="text-gray-400 hover:text-gray-700 text-xl leading-none">{'\\u00d7'}</button>
                                </div>
                                <div className="p-5 overflow-y-auto">
                                  {!refData[a.id] && <div className="text-sm text-gray-500">Loading history{'\\u2026'}</div>}
                                  {refData[a.id] && refData[a.id].error && <div className="text-sm text-red-600">{refData[a.id].error}</div>}
                                  {refData[a.id] && refData[a.id].stats && (
                                    <>
                                      <div className="flex flex-wrap gap-2 mb-4 text-xs">
                                        <span className="px-2 py-1 rounded-lg bg-gray-100">Referred: <b>{refData[a.id].stats.total_referred}</b></span>
                                        <span className="px-2 py-1 rounded-lg bg-green-100 text-green-800">Sold: <b>{refData[a.id].stats.total_sold}</b></span>
                                        <span className="px-2 py-1 rounded-lg bg-blue-100 text-blue-800">Open: <b>{refData[a.id].stats.open_now}</b></span>
                                        {refData[a.id].stats.last_referral && <span className="px-2 py-1 rounded-lg bg-gray-100">Last referral: <b>{refData[a.id].stats.last_referral}</b></span>}
                                        {refData[a.id].stats.last_sale && <span className="px-2 py-1 rounded-lg bg-gray-100">Last sale: <b>{refData[a.id].stats.last_sale}</b></span>}
                                      </div>
                                      {refData[a.id].deals.length === 0 && <div className="text-sm text-gray-500">No referred deals found on this organization.</div>}
                                      <div className="divide-y">
                                        {refData[a.id].deals.map((d) => (
                                          <div key={d.deal_id} className="py-2 flex items-center justify-between gap-3 text-sm">
                                            <div className="min-w-0">
                                              <div className="font-medium truncate">{d.client}</div>
                                              <div className="text-xs text-gray-400">added {d.added || '?'}{d.won ? ` \u00b7 sold ${d.won}` : ''}{d.lost ? ` \u00b7 lost ${d.lost}${d.lost_reason ? ` (${d.lost_reason})` : ''}` : ''}</div>
                                            </div>
                                            <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${d.status === 'won' ? 'bg-green-100 text-green-700' : d.status === 'lost' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-700'}`}>{d.status === 'won' ? 'SOLD' : d.status}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}"""
if s.count(oldE) != 1: fails.append(f"actions anchor x{s.count(oldE)}")
else: s = s.replace(oldE, newE, 1); print("OK 5: history button + modal")

if fails:
    print("ABORTED:"); [print(" -", x) for x in fails]; sys.exit(1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("AFFILIATE FOLLOW-UP VISIBILITY SHIPPED")
