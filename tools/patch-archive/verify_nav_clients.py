import sys
ok = True
a = open('src/App.jsx', encoding='utf-8', errors='surrogateescape').read()
if a.count('path="clients"') != 1 or a.count("import ClientFile") != 1: ok = False; print("App.jsx wiring wrong")
l = open('src/components/Layout.jsx', encoding='utf-8', errors='surrogateescape').read()
c = l.count("path: '/clients'")
if c < 1: ok = False; print("Layout.jsx nav missing")
else: print(f"Layout.jsx: Clients in {c} menus")
if "Users" not in l.split('\n')[0] and "Users," not in l[:2000] and " Users" not in l[:2000]: print("note: verify Users icon is imported in Layout.jsx")
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
sys.exit(0 if ok else 1)
