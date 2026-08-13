import glob, re
print("=== who WRITES consultant_payments ===")
for f in glob.glob('netlify/functions/*.js'):
    s = open(f, encoding='utf-8', errors='surrogateescape').read()
    if 'consultant_payments' in s and re.search(r"(POST|PATCH|upsert|insert).{0,200}consultant_payments|consultant_payments.{0,400}method:\s*['\"](POST|PATCH)", s, re.S | re.I):
        print(f"  WRITER: {f}")
    elif "zoho_api" in s:
        print(f"  mentions zoho_api: {f}")
print()
print("=== the matching logic inside the writer(s) ===")
for f in glob.glob('netlify/functions/*.js'):
    s = open(f, encoding='utf-8', errors='surrogateescape').read()
    if 'consultant_payments' not in s or 'zoho' not in s.lower(): continue
    if not re.search(r"method:\s*['\"]POST|upsert", s): continue
    lines = s.split('\n')
    print(f"--- {f} ({len(s)} chars) ---")
    hits = [i for i, l in enumerate(lines) if re.search(r'deal|match|customer_name|company|consultant_name|owner|resolve', l, re.I)]
    shown = set()
    for h in hits:
        for i in range(max(0, h-2), min(len(lines), h+3)):
            if i not in shown:
                shown.add(i)
                print(f"{i+1:5d}  {lines[i]}")
