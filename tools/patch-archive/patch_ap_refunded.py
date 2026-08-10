import re, sys
f = 'netlify/functions/all-payments.js'
s = open(f, encoding='utf-8').read()
lines = s.split('\n')
hits = [i for i, l in enumerate(lines) if 'consultant_payments?' in l]
print('query lines found:')
for i in hits: print(f'  {i+1}: {lines[i].strip()[:150]}')
targets = [i for i in hits if 'select=' in lines[i] and ('month' in lines[i] or 'payment_month' in lines[i])]
if len(targets) < 1: print('ABORTED: no month-list query recognized - paste the lines above'); sys.exit(1)
changed = 0
for i in targets:
    if 'refunded_at' in lines[i]: continue
    lines[i] = lines[i].replace('consultant_payments?', 'consultant_payments?refunded_at=is.null&', 1)
    changed += 1
if not changed: print('ABORTED: list queries already filtered - nothing to do'); sys.exit(1)
open(f, 'w', encoding='utf-8', newline='').write('\n'.join(lines))
print(f'all-payments: refunded rows excluded from {changed} listing quer(y/ies)')
