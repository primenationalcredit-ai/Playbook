import sys
f = 'src/App.jsx'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
if "import MyDay" in s: print("ABORTED: MyDay already wired"); sys.exit(1)
route_anchor = """<Route path="clients" element={<ClientFile />} />"""
if s.count(route_anchor) != 1: print(f"ABORTED: route anchor x{s.count(route_anchor)}"); sys.exit(1)
s = "import MyDay from './pages/MyDay';\n" + s
s = s.replace(route_anchor, route_anchor + """
        <Route path="my-day" element={<MyDay />} />""", 1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
f2 = 'src/components/Layout.jsx'
s2 = open(f2, encoding='utf-8', errors='surrogateescape').read()
if "path: '/my-day'" in s2: print("ABORTED: nav already has my-day"); sys.exit(1)
nav_anchor = """{ path: '/clients', icon: Users, label: 'Clients' },"""
n = s2.count(nav_anchor)
if n < 1: print("ABORTED: nav anchor x0"); sys.exit(1)
s2 = s2.replace(nav_anchor, nav_anchor + """
    { path: '/my-day', icon: ClipboardList, label: 'My Day' },""")
open(f2, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s2)
f3 = 'src/pages/ClientFile.jsx'
s3 = open(f3, encoding='utf-8', errors='surrogateescape').read()
imp_anchor = """import { supabase } from '../lib/supabase';"""
if s3.count(imp_anchor) != 1: print(f"ABORTED: import anchor x{s3.count(imp_anchor)}"); sys.exit(1)
s3 = s3.replace(imp_anchor, imp_anchor + """
import { useSearchParams } from 'react-router-dom';""", 1)
ref_anchor = """  const debounceRef = useRef(null);"""
if s3.count(ref_anchor) != 1: print(f"ABORTED: ref anchor x{s3.count(ref_anchor)}"); sys.exit(1)
s3 = s3.replace(ref_anchor, ref_anchor + """
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const pid = parseInt(searchParams.get('person'));
    const did = parseInt(searchParams.get('deal')) || undefined;
    if (pid) openClient({ pipedrive_person_id: pid, name: '' }, did);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);""", 1)
open(f3, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s3)
print(f"MyDay wired: route + nav x{n} + ClientFile deep-link")
