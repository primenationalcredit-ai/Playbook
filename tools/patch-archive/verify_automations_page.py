import sys
ok = True
for f, checks in [
  ('src/pages/Automations.jsx', [("automation_registry", 2), ("automation_runs", 1), ("toggle_live", 4)]),
  ('src/App.jsx', [("admin/automations", 1), ("import Automations", 1)]),
  ('src/components/Layout.jsx', [("/admin/automations", 1)]),
]:
    s = open(f, encoding='utf-8').read()
    for needle, want in checks:
        got = s.count(needle)
        if got != want: ok = False
        print(f"{f}: '{needle}' {got}/{want} {'OK' if got == want else 'WRONG'}")
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
sys.exit(0 if ok else 1)
