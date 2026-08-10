import sys
ok = True
s = open('src/pages/AMBonus.jsx', encoding='utf-8', errors='surrogateescape').read()
for needle, want in [("useDailyGate(currentUser, 'account_manager'", 1), ("from '../components/DailyChecklistGate'", 1), ("dailyGate.unlocked) return dailyGate.panel", 1)]:
    got = s.count(needle)
    if got != want: ok = False
    print(f"AMBonus.jsx: '{needle[:45]}' {got}/{want} {'OK' if got == want else 'WRONG'}")
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
sys.exit(0 if ok else 1)
