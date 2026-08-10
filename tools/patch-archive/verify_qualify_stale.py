import sys
s = open('netlify/functions/consultant-bonus-metrics.js', encoding='utf-8', errors='surrogateescape').read()
ok = True
for needle in ["MONEY BEATS STALE PAPERWORK", "balancePaid >= minInv - EPS", "const target = payTarget;", "let qualified = paidTotals.length > 0 || owed <= EPS;"]:
    if needle not in s: ok = False; print(f"MISSING: {needle}")
if "const qualified = paidTotals" in s: ok = False; print("old const qualified still present")
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
sys.exit(0 if ok else 1)
