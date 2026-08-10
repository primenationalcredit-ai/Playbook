import sys
ok = True
s = open('src/pages/FinancialDashboard.jsx', encoding='utf-8', errors='surrogateescape').read()
for needle, want in [("function AuthnetTicker()", 1), ("fetch('/.netlify/functions/authnet-proxy')", 1), ("<AuthnetTicker />", 1), ("setInterval(load, 60000)", 1)]:
    got = s.count(needle)
    if got != want: ok = False
    print(f"FinancialDashboard: '{needle[:44]}' {got}/{want} {'OK' if got == want else 'WRONG'}")
p = open('netlify/functions/authnet-proxy.js', encoding='utf-8', errors='surrogateescape').read()
for needle, want in [("functions/authnet-today?key=", 1)]:
    got = p.count(needle)
    if got != want: ok = False
    print(f"authnet-proxy: '{needle}' {got}/{want} {'OK' if got == want else 'WRONG'}")
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
sys.exit(0 if ok else 1)
