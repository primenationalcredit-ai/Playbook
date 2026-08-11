import sys, re
s = open('netlify/functions/zoho-invoice-sync-manual.js', encoding='utf-8').read()
ok = True
for n in ["MANUAL DOOR", "date_start", "per_page", "upserted"]:
    if n not in s: ok = False; print(f"MISSING: {n}")
# real schedule config, not the word "scheduled" in a comment
if re.search(r"exports\.config|schedule\s*:", s): ok = False; print("actual schedule config present")
t = open('netlify.toml', encoding='utf-8', errors='surrogateescape').read()
if 'zoho-invoice-sync-manual' in t: ok = False; print("manual door is scheduled in netlify.toml - remove it")
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
if not ok: sys.exit(1)
