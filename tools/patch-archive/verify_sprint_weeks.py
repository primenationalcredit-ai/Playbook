import sys
s = open('netlify/functions/consultant-bonus-metrics.js', encoding='utf-8', errors='surrogateescape').read()
ok = True
for needle, want in [("const stubDays = Math.round((wStart - mStart) / 86400000);", 1), ("stubDays > 0 && stubDays <= 2", 1), ("wStart.setDate(wStart.getDate() + 7); // the absorbed week is done", 1), ("} else if (wStart > mStart) { // 3-6 day partial first week stands on its own", 1)]:
    got = s.count(needle)
    if got != want: ok = False
    print(f"metrics: '{needle[:52]}' {got}/{want} {'OK' if got == want else 'WRONG'}")
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
sys.exit(0 if ok else 1)
