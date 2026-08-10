import sys
ok = True
s = open('src/pages/Automations.jsx', encoding='utf-8').read()
# functional checks (not raw string counts): the two fetches, the PATCH toggle, the guard
checks = [
  ("fetch(`${SUPABASE_URL}/rest/v1/automation_registry?select=*", 1),
  ("fetch(`${SUPABASE_URL}/rest/v1/automation_runs?select=*", 1),
  ("method: 'PATCH'", 1),
  ("if (!auto.toggle_live || busy) return;", 1),
  ("RUNS IN ZAPIER", 1),
  ("SWITCH COMING", 1),
]
for needle, want in checks:
    got = s.count(needle)
    if got != want: ok = False
    print(f"Automations.jsx: '{needle[:45]}' {got}/{want} {'OK' if got == want else 'WRONG'}")
for f, needle in [('src/App.jsx', 'admin/automations'), ('src/components/Layout.jsx', '/admin/automations')]:
    got = open(f, encoding='utf-8').read().count(needle)
    if got != 1: ok = False
    print(f"{f}: '{needle}' {got}/1 {'OK' if got == 1 else 'WRONG'}")
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
sys.exit(0 if ok else 1)
