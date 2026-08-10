import sys
f = 'src/lib/transactionCategorization.js'
s = open(f, encoding='utf-8').read()
old = """  'legal fee',
  'legal fees'
];"""
new = """  'legal fee',
  'legal fees',
  'vsl queen',
  'vslqueen',
  'vsl-queen'
];"""
if s.count(old) != 1: print(f"ABORTED: lib anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("lib: VSL Queen excluded")

f = 'src/pages/FinancialDashboard.jsx'
s = open(f, encoding='utf-8').read()
old = "const OWNER_COST_PATTERNS = ['facebk', 'facebook', 'meta ads', 'metaplatforms', 'meta platforms', 'attorney', 'law office', 'law offices', 'law firm', 'lawyer', 'legal fee', 'legal fees'];"
new = "const OWNER_COST_PATTERNS = ['facebk', 'facebook', 'meta ads', 'metaplatforms', 'meta platforms', 'attorney', 'law office', 'law offices', 'law firm', 'lawyer', 'legal fee', 'legal fees', 'vsl queen', 'vslqueen', 'vsl-queen'];"
if s.count(old) != 1: print(f"ABORTED: FD anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("FD: VSL Queen excluded")
