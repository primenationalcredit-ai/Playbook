import sys
f = 'src/App.jsx'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
if "import Pipelines" in s: print("ABORTED: already wired"); sys.exit(1)
route_anchor = """<Route path="my-day" element={<MyDay />} />"""
if s.count(route_anchor) != 1: print(f"ABORTED: route anchor x{s.count(route_anchor)}"); sys.exit(1)
s = "import Pipelines from './pages/Pipelines';\n" + s
s = s.replace(route_anchor, route_anchor + """
        <Route path="pipelines" element={<Pipelines />} />""", 1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
f2 = 'src/components/Layout.jsx'
s2 = open(f2, encoding='utf-8', errors='surrogateescape').read()
if "path: '/pipelines'" in s2: print("ABORTED: nav already"); sys.exit(1)
nav_anchor = """{ path: '/my-day', icon: ClipboardList, label: 'My Day' },"""
n = s2.count(nav_anchor)
if n < 1: print("ABORTED: nav anchor x0"); sys.exit(1)
s2 = s2.replace(nav_anchor, nav_anchor + """
    { path: '/pipelines', icon: Shuffle, label: 'Pipelines' },""")
open(f2, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s2)
print(f"Pipelines wired: route + nav x{n}")
