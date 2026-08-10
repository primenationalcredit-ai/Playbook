import sys

f = 'src/App.jsx'
s = open(f, encoding='utf-8').read()
old = "import AdditionalRounds from './pages/AdditionalRounds';"
new = "import AdditionalRounds from './pages/AdditionalRounds';\nimport Automations from './pages/Automations';"
if s.count(old) != 1: print(f"ABORTED: App import anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
old = '              <Route path="admin/additional-rounds" element={<AdditionalRounds />} />'
new = '              <Route path="admin/additional-rounds" element={<AdditionalRounds />} />\n              <Route path="admin/automations" element={<Automations />} />'
if s.count(old) != 1: print(f"ABORTED: App route anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("App.jsx: route + import added")

f = 'src/components/Layout.jsx'
s = open(f, encoding='utf-8').read()
old = "    ...(isAccountManagerDept ? [{ path: '/admin/additional-rounds', icon: DollarSign, label: 'Additional Rounds' }] : []),"
new = """    ...(isAccountManagerDept ? [{ path: '/admin/additional-rounds', icon: DollarSign, label: 'Additional Rounds' }] : []),
    ...(isLeadership ? [{ path: '/admin/automations', icon: ShieldCheck, label: 'Automations' }] : []),"""
if s.count(old) != 1: print(f"ABORTED: Layout nav anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("Layout.jsx: Automations nav item (leadership only)")
