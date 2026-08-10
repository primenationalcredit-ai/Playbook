import sys
f = 'netlify/functions/payments-live.js'
s = open(f, encoding='utf-8').read()
old = "consultant_payments?refunded_at=gte.${ym}-01&refunded_at=lt.${nextYm}-01&excluded_from_bonus=eq.false&select="
new = "consultant_payments?refunded_at=gte.${ym}-01&refunded_at=lt.${nextYm}-01&payment_month=eq.${ym}&excluded_from_bonus=eq.false&select="
if s.count(old) != 1: print(f"ABORTED: negatives anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("refund lines only hit the month the ORIGINAL payment was made - old-money refunds no longer reduce current-month sales")
