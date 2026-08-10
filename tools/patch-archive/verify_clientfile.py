import sys
ok = True
s = open('src/pages/ClientFile.jsx', encoding='utf-8', errors='surrogateescape').read()
for needle in ["from('crm_clients')", "from('crm_deals')", "from('crm_rounds')", "from('crm_field_options')", "from('consultant_payments')", "from('crm_notes')", "from('crm_activities')", "export default ClientFile"]:
    if needle not in s: ok = False; print(f"ClientFile MISSING: {needle}")
a = open('src/App.jsx', encoding='utf-8', errors='surrogateescape').read()
if a.count('path="clients"') != 1 or a.count("import ClientFile") != 1: ok = False; print("App.jsx wiring wrong")
l = open('src/components/Layout.jsx', encoding='utf-8', errors='surrogateescape').read()
if l.count("path: '/clients'") != 1: ok = False; print("Layout.jsx nav wrong")
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
sys.exit(0 if ok else 1)
