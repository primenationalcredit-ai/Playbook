import re
f = 'src/pages/AffiliateOutreach.jsx'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
print(f"########## {f} ({len(s)} chars) ##########")
lines = s.split('\n')
hits = [i for i, l in enumerate(lines) if re.search(r'queue|Queue|/ ?20|of 20|completed|Completed|called|Called|done|Done|progress|Progress|localStorage|sessionStorage|slice\(0', l)]
shown = set()
for h in hits:
    for i in range(max(0, h-3), min(len(lines), h+4)):
        if i not in shown:
            shown.add(i)
            print(f"{i+1:5d}  {lines[i]}")
