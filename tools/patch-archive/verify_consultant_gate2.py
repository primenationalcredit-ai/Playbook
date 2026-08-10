import sys
ok = True
s = open('src/pages/ConsultantBonus.jsx', encoding='utf-8', errors='surrogateescape').read()
for needle, want in [("useDailyGate(currentUser, 'consultant'", 1), ("from '../components/DailyChecklistGate'", 1), ("dailyGate.unlocked) return dailyGate.panel", 1)]:
    got = s.count(needle)
    if got != want: ok = False
    print(f"ConsultantBonus.jsx: '{needle[:45]}' {got}/{want} {'OK' if got == want else 'WRONG'}")
g = open('src/components/DailyChecklistGate.jsx', encoding='utf-8', errors='surrogateescape').read()
for needle, want in [("export function useDailyGate", 1), ("rest/v1/role_daily_checklist", 2), ("export const CONSULTANT_CHECKLIST", 1), ("export const AM_CHECKLIST", 1)]:
    got = g.count(needle)
    if got != want: ok = False
    print(f"DailyChecklistGate.jsx: '{needle}' {got}/{want} {'OK' if got == want else 'WRONG'}")
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
sys.exit(0 if ok else 1)
