import sys
f = 'src/App.jsx'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
route_anchor = """<Route path="dashboard" element={<Dashboard />} />"""
if s.count(route_anchor) != 1: print(f"ABORTED: route anchor x{s.count(route_anchor)}"); sys.exit(1)
s = "import ClientFile from './pages/ClientFile';\n" + s
s = s.replace(route_anchor, route_anchor + """
        <Route path="clients" element={<ClientFile />} />""", 1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
f2 = 'src/components/Layout.jsx'
s2 = open(f2, encoding='utf-8', errors='surrogateescape').read()
nav_anchor = """{ path: '/bonus-tracker', icon: Trophy, label: 'Bonus & Payment Tracker' },"""
if s2.count(nav_anchor) != 1: print(f"ABORTED: nav anchor x{s2.count(nav_anchor)}"); sys.exit(1)
s2 = s2.replace(nav_anchor, """{ path: '/clients', icon: Users, label: 'Clients' },
    """ + nav_anchor, 1)
open(f2, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s2)
print("App.jsx: import + /clients route in; Layout.jsx: Clients nav entry in")
