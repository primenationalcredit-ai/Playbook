import sys
s = open('src/pages/AffiliateOutreach.jsx', encoding='utf-8', errors='surrogateescape').read()
ok = True
for needle in ["doneToday, setDoneToday", "done today</span>", "list refills as you finish", "completed_at=gte."]:
    if needle not in s: ok = False; print(f"MISSING: {needle}")
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
sys.exit(0 if ok else 1)
