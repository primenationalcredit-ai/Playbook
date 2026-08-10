import sys
s = open('src/pages/ConsultantPayments.jsx', encoding='utf-8', errors='surrogateescape').read()
ok = True
for needle, want in [("function AuthnetTicker()", 1), ("fetch('/.netlify/functions/authnet-proxy')", 1), ("<AuthnetTicker />", 1)]:
    got = s.count(needle)
    if got != want: ok = False
    print(f"ConsultantPayments: '{needle[:44]}' {got}/{want} {'OK' if got == want else 'WRONG'}")
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
sys.exit(0 if ok else 1)
