import sys, re
f = sys.argv[1]
s = open(f, encoding='utf-8').read()
lines = s.split('\n')
hits = [i for i, l in enumerate(lines) if 'scheduled_charges' in l and 'select=' in l]
print('charge queries in the billing fn:')
for i in hits: print(f'  {i+1}: {lines[i].strip()[:160]}')
changed = 0
for i in hits:
    if 'select=*' in lines[i] or 'zoho_invoice_id' in lines[i]: continue
    m = re.search(r'select=([A-Za-z0-9_,]+)', lines[i])
    if m:
        lines[i] = lines[i].replace('select=' + m.group(1), 'select=' + m.group(1) + ',zoho_invoice_id', 1)
        changed += 1
if changed:
    open(f, 'w', encoding='utf-8', newline='').write('\n'.join(lines))
    print(f'added zoho_invoice_id to {changed} quer(y/ies) - deploy needed')
else:
    print('payload already carries zoho_invoice_id (select=* or explicit) - UI deploy from before is all that was needed')
