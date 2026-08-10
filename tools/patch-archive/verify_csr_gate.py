import sys
s = open('src/pages/CSRBonus.jsx', encoding='utf-8', errors='surrogateescape').read()
ok = True
for needle, want in [("csr_daily_checklist", 2), ("America/Chicago", 1), ("Complete today's check-in checklist", 1), ("filter/6156", 1), ("gateUnlocked", 2), ("CHECK_ITEMS.every", 1), ("on_conflict=csr_email,day", 1)]:
    got = s.count(needle)
    if got != want: ok = False
    print(f"CSRBonus.jsx: '{needle}' {got}/{want} {'OK' if got == want else 'WRONG'}")
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
sys.exit(0 if ok else 1)
