import sys
f = 'netlify/functions/refund-webhook.js'
s = open(f, encoding='utf-8').read()
old = """        deduction_amount: 0,
        refund_reason: b.reason || 'refund'"""
new = """        deduction_amount: 0,
        deduction_percentage: 0,
        refund_reason: b.reason || 'refund'"""
if s.count(old) != 1: print(f"ABORTED: pct anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("webhook ledger write: all required fields covered")
