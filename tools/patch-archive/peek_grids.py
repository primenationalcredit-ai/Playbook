import re
s = open('src/pages/ConsultantPayments.jsx', encoding='utf-8').read()
# every grid row declaration, with exact repr
for m in re.finditer(r'^[ \t]*<div className="grid[^"]*">', s, re.M):
    print(repr(m.group(0)))
print('---')
i = s.find('Fee Breakdown Cards')
print(repr(s[i:i+220]))
