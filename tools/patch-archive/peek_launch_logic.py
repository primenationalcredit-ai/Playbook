import re
s = open('netlify/functions/consultant-bonus-metrics.js', encoding='utf-8', errors='surrogateescape').read()
lines = s.split('\n')
print("=== New Affiliate Launch logic ===")
shown = set()
for i, l in enumerate(lines):
    if re.search(r'launch|new.affiliate|affiliate_launch|first 60|60 days|75', l, re.I):
        for j in range(max(0, i-2), min(len(lines), i+3)):
            if j not in shown: shown.add(j); print(f"{j+1:5d}  {lines[j][:170]}")
