import sys
ok = True
m = open('src/pages/MyDay.jsx', encoding='utf-8', errors='surrogateescape').read()
for needle in ["crm-activity-write", "ilike('owner_name'", "export default MyDay", "to={`/clients?person="]:
    if needle not in m: ok = False; print(f"MyDay MISSING: {needle}")
a = open('src/App.jsx', encoding='utf-8', errors='surrogateescape').read()
if a.count('path="my-day"') != 1 or a.count("import MyDay") != 1: ok = False; print("App.jsx wiring wrong")
l = open('src/components/Layout.jsx', encoding='utf-8', errors='surrogateescape').read()
if l.count("path: '/my-day'") < 1: ok = False; print("Layout nav missing")
c = open('src/pages/ClientFile.jsx', encoding='utf-8', errors='surrogateescape').read()
if "useSearchParams" not in c or "searchParams.get('person')" not in c: ok = False; print("ClientFile deep-link missing")
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
sys.exit(0 if ok else 1)
