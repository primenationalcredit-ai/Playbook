import sys, re
f = 'src/pages/AffiliateOutreach.jsx'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
# ---- 1) call queue = default tab ----
a1 = "const [tab, setTab] = useState('book');"
if s.count(a1) != 1: print("ABORTED: tab default anchor x" + str(s.count(a1))); sys.exit(1)
s = s.replace(a1, "const [tab, setTab] = useState('calls'); // Joe 8/13: call queue is the first thing consultants see", 1)
# ---- 2) Messages tab: leadership only ----
m = re.search(r"const\s+(\w+)\s*=\s*[^\n]*'leadership'[^\n]*", s)
if not m: print("ABORTED: no leadership predicate found in this file - report back"); sys.exit(1)
lead = m.group(1)
start = "<button onClick={() => setTab('messages')}"
if s.count(start) != 1: print("ABORTED: messages button anchor x" + str(s.count(start))); sys.exit(1)
i = s.index(start)
j = s.index("</button>", i)
if j - i > 400: print("ABORTED: messages button block suspiciously long"); sys.exit(1)
block = s[i:j + len("</button>")]
s = s.replace(block, "{" + lead + " && (" + block + ")}", 1)
# ---- 3) tel: links on the remaining plain-text phones ----
a3 = "{a.contact_email || 'no email'}{a.contact_phone ? ` \u00b7 ${a.contact_phone}` : ''}"
if s.count(a3) != 1: print("ABORTED: book phone anchor x" + str(s.count(a3))); sys.exit(1)
r3 = "{a.contact_email || 'no email'}{a.contact_phone ? <> {'\\u00b7'} <a href={`tel:${String(a.contact_phone).replace(/[^0-9+]/g, '')}`} className=\"text-blue-600 hover:underline\" onClick={(e) => e.stopPropagation()}>{a.contact_phone}</a></> : ''}"
s = s.replace(a3, r3, 1)
a4 = "{refData[a.id].contact.phone ? ` \\u00b7 ${refData[a.id].contact.phone}` : ''}"
if s.count(a4) != 1: print("ABORTED: refcontact phone anchor x" + str(s.count(a4))); sys.exit(1)
r4 = "{refData[a.id].contact.phone ? <> {' \\u00b7 '}<a href={`tel:${String(refData[a.id].contact.phone).replace(/[^0-9+]/g, '')}`} className=\"text-blue-600 hover:underline\">{refData[a.id].contact.phone}</a></> : ''}"
s = s.replace(a4, r4, 1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
print("patched: default tab=calls, Messages tab " + lead + "-only, 2 more tel: links")
