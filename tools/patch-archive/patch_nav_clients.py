import sys
f = 'src/components/Layout.jsx'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
if "path: '/clients'" in s: print("ABORTED: /clients already in nav"); sys.exit(1)
anchor = """{ path: '/bonus-tracker', icon: Trophy, label: 'Bonus & Payment Tracker' },"""
n = s.count(anchor)
if n < 1: print("ABORTED: anchor x0"); sys.exit(1)
s = s.replace(anchor, """{ path: '/clients', icon: Users, label: 'Clients' },
    """ + anchor)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
print(f"Layout.jsx: Clients added to {n} nav menus")
