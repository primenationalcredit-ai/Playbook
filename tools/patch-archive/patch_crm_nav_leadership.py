import sys, re
f = 'src/components/Layout.jsx'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
lines = [
    "\n    { path: '/clients', icon: Users, label: 'Clients' },",
    "\n    { path: '/my-day', icon: ClipboardList, label: 'My Day' },",
    "\n    { path: '/pipelines', icon: Shuffle, label: 'Pipelines' },",
    "\n    { path: '/my-book', icon: BookOpen, label: 'My Book' },",
]
# find every occurrence of each line with its backward context
def contexts(needle):
    out = []
    start = 0
    while True:
        i = s.find(needle, start)
        if i < 0: break
        out.append((i, s[max(0, i-600):i].lower()))
        start = i + 1
    return out
occ = {n: contexts(n) for n in lines}
for n, cs in occ.items():
    if len(cs) != 2:
        print(f"ABORTED: {n.strip()[:40]}... found x{len(cs)}, expected 2 (menus changed?)")
        for i, ctx in cs: print(f"  at {i}: ...{ctx[-120:]}")
        sys.exit(1)
# decide which occurrence is the leadership menu: 'leadership' appears in backward context
removals = []
for n, cs in occ.items():
    lead = [i for i, ctx in cs if 'leadership' in ctx]
    non = [i for i, ctx in cs if 'leadership' not in ctx]
    if len(lead) != 1 or len(non) != 1:
        print(f"ABORTED: cannot tell menus apart for {n.strip()[:40]}...")
        for i, ctx in cs: print(f"  at {i}: ...{ctx[-160:]}")
        sys.exit(1)
    removals.append((non[0], n))
# remove from the highest offset down so positions stay valid
for i, n in sorted(removals, reverse=True):
    s = s[:i] + s[i+len(n):]
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
print("Layout: CRM nav entries removed from the non-leadership menu (4 removals); leadership menu untouched")
