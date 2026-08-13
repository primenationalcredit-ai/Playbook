import re
s = open('netlify/functions/consultant-bonus-metrics.js', encoding='utf-8', errors='surrogateescape').read()
lines = s.split('\n')
print("=== qualifyClient: the actual qualification rule ===")
start = None
for i, l in enumerate(lines):
    if 'qualifyClient' in l and ('function' in l or '=>' in l or 'const qualifyClient' in l):
        start = i; break
if start is None:
    hits = [i for i, l in enumerate(lines) if 'qualifyClient' in l]
    print("definition not found; call sites:", [h+1 for h in hits])
else:
    for i in range(start, min(len(lines), start + 90)):
        print(f"{i+1:5d}  {lines[i][:170]}")
