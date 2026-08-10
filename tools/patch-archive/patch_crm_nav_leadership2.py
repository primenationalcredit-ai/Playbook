import sys
f = 'src/components/Layout.jsx'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
old = """    ...(!hideExtras ? [{ path: '/team', icon: Users, label: 'Team View' }] : []),
    { path: '/clients', icon: Users, label: 'Clients' },
    { path: '/my-day', icon: ClipboardList, label: 'My Day' },
    { path: '/pipelines', icon: Shuffle, label: 'Pipelines' },
    { path: '/my-book', icon: BookOpen, label: 'My Book' },"""
new = """    ...(!hideExtras ? [{ path: '/team', icon: Users, label: 'Team View' }] : []),"""
if s.count(old) != 1: print(f"ABORTED: employee-menu anchor x{s.count(old)}"); sys.exit(1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s.replace(old, new, 1))
print("Layout: CRM nav removed from coreNavItems (employee menu); leadership navItems untouched")
