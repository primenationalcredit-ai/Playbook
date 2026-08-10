import sys
f = 'src/components/Layout.jsx'
s = open(f, encoding='utf-8').read()
old = "    ...(currentUser?.department === 'account_managers' || currentUser?.role === 'admin' ? [{ path: '/secured-cards', icon: CreditCard, label: 'Secured Cards' }] : []),"
new = """    ...(currentUser?.department === 'account_managers' || currentUser?.role === 'admin' ? [{ path: '/secured-cards', icon: CreditCard, label: 'Secured Cards' }] : []),
    // AMs get Additional Rounds (Joe 8/4) - same page, admin-only actions stay gated inside it
    ...(currentUser?.department === 'account_managers' && currentUser?.role !== 'admin' ? [{ path: '/admin/additional-rounds', icon: DollarSign, label: 'Additional Rounds' }] : []),"""
if s.count(old) != 1: print(f"ABORTED: nav anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("nav: AMs see the Additional Rounds tab")
