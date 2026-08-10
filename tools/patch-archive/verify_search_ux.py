import sys
ok = True
s = open('src/pages/ClientFile.jsx', encoding='utf-8', errors='surrogateescape').read()
for needle in ["{!client && (", "New search", "r.latest_stage", "r.latest_deal_status"]:
    if needle not in s: ok = False; print(f"MISSING: {needle}")
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
sys.exit(0 if ok else 1)
