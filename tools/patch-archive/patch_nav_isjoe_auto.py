import sys
f = 'src/components/Layout.jsx'
s = open(f, encoding='utf-8').read()
old = "    { path: '/agreements', icon: FileText, label: 'Agreements' },"
new = """    { path: '/agreements', icon: FileText, label: 'Agreements' },
    { path: '/admin/automations', icon: ShieldCheck, label: 'Automations' },"""
if s.count(old) != 1: print(f"ABORTED: isJoe agreements anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
got = s.count("/admin/automations")
print(f"'/admin/automations' now appears {got}x (want 2: leadership array + isJoe array) {'OK' if got == 2 else 'WRONG - DO NOT PUSH'}")
sys.exit(0 if got == 2 else 1)
