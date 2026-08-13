import re
f = 'src/pages/ConsultantPayments.jsx'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
lines = s.split('\n')
hits = [i for i, l in enumerate(lines) if re.search(r'authnet|Auth\.net|balanced|ticker|Ticker', l)]
shown = set()
for h in hits:
    for i in range(max(0, h-3), min(len(lines), h+4)):
        if i not in shown:
            shown.add(i)
            print(f"{i+1:5d}  {lines[i]}")
