import sys
f = 'netlify/functions/refund-webhook.js'
s = open(f, encoding='utf-8').read()
old = """        pipedrive_deal_id: String(b.pipedrive_deal_id),
        deduction_amount: 0
      })"""
new = """        pipedrive_deal_id: String(b.pipedrive_deal_id),
        deduction_amount: 0,
        refund_reason: b.reason || 'refund'
      })"""
if s.count(old) != 1: print(f"ABORTED: reason anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("webhook ledger write satisfies the required reason field")
