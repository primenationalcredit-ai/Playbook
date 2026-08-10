import sys
s = open('src/pages/ConsultantPayments.jsx', encoding='utf-8', errors='surrogateescape').read()
ok = True
for needle, want in [("department=eq.credit_consultants&select=name,pipedrive_name", 1), ("consultants = consultants.filter(c => onRoster(c.name))", 1), ("roster filter failed", 1)]:
    got = s.count(needle)
    if got != want: ok = False
    print(f"ConsultantPayments: '{needle[:48]}' {got}/{want} {'OK' if got == want else 'WRONG'}")
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
sys.exit(0 if ok else 1)
