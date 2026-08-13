import glob, re
print("=== zoho-invoice-sync: how it walks + what it matches ===")
for f in glob.glob('netlify/functions/*zoho*invoice*.js') + glob.glob('netlify/functions/*invoice*sync*.js'):
    s = open(f, encoding='utf-8', errors='surrogateescape').read()
    lines = s.split('\n')
    print(f"--- {f} ({len(lines)} lines) ---")
    hits = [i for i, l in enumerate(lines) if re.search(r'page|per_page|date_start|created_time|last_modified|range|limit|days', l, re.I)]
    shown = set()
    for h in hits:
        for i in range(max(0, h-1), min(len(lines), h+2)):
            if i not in shown:
                shown.add(i)
                print(f"{i+1:5d}  {lines[i][:160]}")
