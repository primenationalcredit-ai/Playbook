import sys
ok = True
checks = [
  ('consultant-bonus-metrics', "Object.values(windowClientMap)) {\n        if (!client.hasDocFee", 1),
  ('consultant-bonus-metrics', "pifFinalMonth !== targetMonth", 1),
  ('consultant-bonus-sync', "d.setDate(d.getDate() + 1); // day AFTER signup", 1),
  ('final-credit-hook', "d.setDate(d.getDate() + 1); // day AFTER signup is day 1", 1),
  ('qualified-doc-watchdog', "d.setDate(d.getDate() + 1); // day AFTER signup is day 1", 1),
]
for fn, needle, want in checks:
    s = open('netlify/functions/' + fn + '.js', encoding='utf-8', errors='surrogateescape').read()
    got = s.count(needle)
    if got != want: ok = False
    print(f"{fn}: '{needle[:45]}' {got}/{want} {'OK' if got == want else 'WRONG'}")
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
sys.exit(0 if ok else 1)
