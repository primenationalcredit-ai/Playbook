import sys
f = 'netlify/functions/all-payments.js'
s = open(f, encoding='utf-8').read()
old = "const res = await fetch(`${SUPABASE_URL}/rest/v1/consultant_payments?${filter}order=payment_date.desc&select=*&limit=${pageSize}&offset=${offset}`, {"
new = "const res = await fetch(`${SUPABASE_URL}/rest/v1/consultant_payments?refunded_at=is.null&${filter}order=payment_date.desc&select=*&limit=${pageSize}&offset=${offset}`, {"
if s.count(old) != 1: print(f"ABORTED: listing anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("all-payments listing: refunded rows excluded")
lines = s.split('\n')
print('--- context around line 103 (for judgment) ---')
for i in range(96, 112):
    if i < len(lines): print(f'{i+1}: {lines[i][:150]}')
