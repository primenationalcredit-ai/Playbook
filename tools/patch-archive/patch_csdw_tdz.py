# cs-deals-webhook: the 7/24 null-site guard reads `existing` BEFORE its
# declaration (JS temporal dead zone -> ReferenceError). Crashes on every
# deal whose monitoring site is empty at event time - i.e. every fresh
# deal add. Fix: load `existing` right after dealData, drop the late decl.
import sys
f = 'netlify/functions/cs-deals-webhook.js'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
fails = []

late = "    const existing = await getExistingRow(dealId);"
n_late = s.count(late)
if n_late != 1:
    fails.append(f"late-decl anchor x{n_late}")
else:
    s = s.replace(late, "    // (existing is loaded earlier, right after dealData - it is used by the site guard above)", 1)

anchor = "const dealData = freshDeal || current; // fall back to payload if the fetch fails"
n_a = s.count(anchor)
if n_a != 1:
    fails.append(f"dealData anchor x{n_a}")
else:
    s = s.replace(anchor, anchor + "\n    const existing = await getExistingRow(dealId);", 1)

if fails:
    print("ABORTED:"); [print(" -", x) for x in fails]
    for i, ln in enumerate(s.split('\n'), 1):
        if 'existing' in ln and 'getExistingRow' in ln: print(f"{i}: {ln.rstrip()[:150]}")
    sys.exit(1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
print("TDZ FIXED: existing loads before the site guard - fresh deal adds no longer crash")
