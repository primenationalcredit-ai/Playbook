import sys
ok = True
m = open('src/pages/MyBook.jsx', encoding='utf-8', errors='surrogateescape').read()
for needle in ["crm_am_roster", "account_manager_name", "export default MyBook", "to={`/clients?person="]:
    if needle not in m: ok = False; print(f"MyBook MISSING: {needle}")
a = open('src/App.jsx', encoding='utf-8', errors='surrogateescape').read()
if a.count('path="my-book"') != 1 or a.count("import MyBook") != 1: ok = False; print("App.jsx wiring wrong")
l = open('src/components/Layout.jsx', encoding='utf-8', errors='surrogateescape').read()
if l.count("path: '/my-book'") < 1: ok = False; print("Layout nav missing")
if "BookOpen" not in l: ok = False; print("BookOpen icon not imported")
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
sys.exit(0 if ok else 1)
