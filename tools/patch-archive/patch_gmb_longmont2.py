import sys, re
FILES = ['src/pages/IncomingReviews.jsx', 'src/pages/ReviewRandomizer.jsx', 'src/pages/Reviews.jsx']
GOOD = "{ name: 'ASAP Credit Repair Longmont', city: 'Longmont', state: 'CO' }"
BAD = "{ name: 'Longmont', city: 'Longmont', state: 'CO' }"
for f in FILES:
    s = open(f, encoding='utf-8').read()
    if BAD in s:
        s = s.replace(BAD, GOOD, 1)
        open(f, 'w', encoding='utf-8', newline='').write(s)
        print(f'{f}: bare entry corrected to full GMB name')
        continue
    if 'Longmont' in s:
        print(f'{f}: already has Longmont - untouched')
        continue
    m = re.search(r'GMB_LOCATIONS = \[(.*?)\];', s, re.S)
    if not m: print(f'ABORTED: {f} has no GMB_LOCATIONS array'); sys.exit(1)
    lasts = re.findall(r"\{\s*name:\s*'[^']*',\s*city:\s*'[^']*',\s*state:\s*'[^']*'\s*\}", m.group(1))
    if not lasts: print(f'ABORTED: {f} entry format differs'); sys.exit(1)
    s = s.replace(lasts[-1], lasts[-1] + ",\n  " + GOOD, 1)
    open(f, 'w', encoding='utf-8', newline='').write(s)
    print(f'{f}: Longmont added')
print('--- verification: Longmont in all three files ---')
for f in FILES:
    ok = "'ASAP Credit Repair Longmont'" in open(f, encoding='utf-8').read()
    print(f'{f}: {"OK" if ok else "MISSING - DO NOT PUSH"}')
    if not ok: sys.exit(1)
