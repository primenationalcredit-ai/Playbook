import sys
f = 'src/pages/Reviews.jsx'
s = open(f, encoding='utf-8').read()
old = """  { name: 'ASAP Credit Repair McAllen', city: 'McAllen', state: 'TX' },
];"""
new = """  { name: 'ASAP Credit Repair McAllen', city: 'McAllen', state: 'TX' },
  { name: 'ASAP Credit Repair Longmont', city: 'Longmont', state: 'CO' },
];"""
if s.count(old) != 1: print(f"ABORTED: Reviews.jsx anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("Reviews.jsx (the Add Review form): Longmont added")
ok1 = "'ASAP Credit Repair Longmont'" in open('src/pages/Reviews.jsx', encoding='utf-8').read()
ok2 = "'ASAP Credit Repair Longmont'" in open('src/pages/IncomingReviews.jsx', encoding='utf-8').read()
print(f"verification - Reviews.jsx: {'OK' if ok1 else 'MISSING'} | IncomingReviews.jsx: {'OK' if ok2 else 'MISSING'}")
if not (ok1 and ok2): sys.exit(1)
