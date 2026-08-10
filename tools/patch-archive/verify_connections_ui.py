import sys
ok = True
s = open('src/pages/Automations.jsx', encoding='utf-8').read()
for needle, want in [("connections-proxy", 1), ("setConns", 2), ("No connections stored yet", 1), ("Recent runs (auto-refreshes)", 1)]:
    got = s.count(needle)
    if got != want: ok = False
    print(f"Automations.jsx: '{needle}' {got}/{want} {'OK' if got == want else 'WRONG'}")
p = open('netlify/functions/connections-proxy.js', encoding='utf-8').read()
for needle, want in [("action !== 'list'", 1), ("connection-admin", 2)]:
    got = p.count(needle)
    if got != want: ok = False
    print(f"connections-proxy.js: '{needle}' {got}/{want} {'OK' if got == want else 'WRONG'}")
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
sys.exit(0 if ok else 1)
