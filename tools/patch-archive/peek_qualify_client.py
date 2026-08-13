import re
s = open('netlify/functions/consultant-bonus-metrics.js', encoding='utf-8', errors='surrogateescape').read()
lines = s.split('\n')
# print the entire qualifyClient function + firstAdvance assignment lines
start = None
for i, l in enumerate(lines):
    if 'qualifyClient' in l and ('function' in l or '=>' in l or 'const qualifyClient' in l):
        start = i; break
if start is not None:
    depth = 0; began = False
    for i in range(start, min(len(lines), start + 120)):
        print(f"{i+1:5d}  {lines[i]}")
        depth += lines[i].count('{') - lines[i].count('}')
        if '{' in lines[i]: began = True
        if began and depth <= 0: break
print("=" * 60)
for i, l in enumerate(lines):
    if 'firstAdvance' in l:
        print(f"{i+1:5d}  {l}")
