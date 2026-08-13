import re
f = 'netlify/functions/affiliate-cadence-runner.js'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
print(f"########## {f} ({len(s)} chars) ##########")
lines = s.split('\n')
hits = [i for i, l in enumerate(lines) if re.search(r'queued|promote|open|MAX|max|20|slot|active|status.*eq|call_task', l)]
shown = set()
for h in hits:
    for i in range(max(0, h-2), min(len(lines), h+3)):
        if i not in shown:
            shown.add(i)
            print(f"{i+1:5d}  {lines[i]}")
