import sys
f = 'src/App.jsx'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
if "import MyBook" in s: print("ABORTED: already wired"); sys.exit(1)
route_anchor = """<Route path="pipelines" element={<Pipelines />} />"""
if s.count(route_anchor) != 1: print(f"ABORTED: route anchor x{s.count(route_anchor)}"); sys.exit(1)
s = "import MyBook from './pages/MyBook';\n" + s
s = s.replace(route_anchor, route_anchor + """
        <Route path="my-book" element={<MyBook />} />""", 1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
f2 = 'src/components/Layout.jsx'
s2 = open(f2, encoding='utf-8', errors='surrogateescape').read()
if "path: '/my-book'" in s2: print("ABORTED: nav already"); sys.exit(1)
nav_anchor = """{ path: '/pipelines', icon: Shuffle, label: 'Pipelines' },"""
n = s2.count(nav_anchor)
if n < 1: print("ABORTED: nav anchor x0"); sys.exit(1)
s2 = s2.replace(nav_anchor, nav_anchor + """
    { path: '/my-book', icon: BookOpen, label: 'My Book' },""")
if "BookOpen" not in s2.split("from 'lucide-react'")[0]:
    lucide_anchor = "Shuffle"
    first_import = s2.find("from 'lucide-react'")
    seg = s2[:first_import]
    if lucide_anchor in seg:
        s2 = s2.replace(lucide_anchor, lucide_anchor + ", BookOpen", 1)
open(f2, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s2)
print(f"MyBook wired: route + nav x{n}")
