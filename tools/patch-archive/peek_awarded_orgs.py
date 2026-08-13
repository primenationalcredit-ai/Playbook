import re
s = open('netlify/functions/consultant-bonus-metrics.js', encoding='utf-8', errors='surrogateescape').read()
lines = s.split('\n')
print("=== how awardedOrgs is loaded ===")
shown = set()
for i, l in enumerate(lines):
    if re.search(r'awardedOrgs', l):
        for j in range(max(0, i-4), min(len(lines), i+5)):
            if j not in shown: shown.add(j); print(f"{j+1:5d}  {lines[j][:175]}")
