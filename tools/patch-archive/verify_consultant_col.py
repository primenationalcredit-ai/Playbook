import sys
ok = True
a = open('netlify/functions/invoices-api.js', encoding='utf-8', errors='surrogateescape').read()
for needle, want in [("async function addConsultantNames", 1), ("rest/v1/consultant_payments?pipedrive_deal_id=in.", 1), ("listData = await addConsultantNames(listData)", 1)]:
    got = a.count(needle)
    if got != want: ok = False
    print(f"invoices-api: '{needle[:46]}' {got}/{want} {'OK' if got == want else 'WRONG'}")
i = open('src/pages/Invoices.jsx', encoding='utf-8', errors='surrogateescape').read()
for needle, want in [('py-2">Consultant</th>', 1), ("{i.consultant_name || '\\u2014'}", 1)]:
    got = i.count(needle)
    if got != want: ok = False
    print(f"Invoices.jsx: '{needle}' {got}/{want} {'OK' if got == want else 'WRONG'}")
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
sys.exit(0 if ok else 1)
