import sys
ok = True
r = open('netlify/functions/affiliate-cadence-runner.js', encoding='utf-8', errors='surrogateescape').read()
for needle in ["DAILY BATCH (Joe 8/10", "isWeekday ? (queuedRes.json || []) : []", "doneRes.json", "completed_at=gte.${dayStartIso}"]:
    if needle not in r: ok = False; print(f"runner MISSING: {needle}")
u = open('src/pages/AffiliateOutreach.jsx', encoding='utf-8', errors='surrogateescape').read()
for needle in ["doneToday, setDoneToday", "done today", "waiting for upcoming days", "loads each weekday morning"]:
    if needle not in u: ok = False; print(f"UI MISSING: {needle}")
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
sys.exit(0 if ok else 1)
