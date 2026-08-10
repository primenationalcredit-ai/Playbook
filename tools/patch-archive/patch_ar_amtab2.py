import sys
f = 'src/components/Layout.jsx'
s = open(f, encoding='utf-8').read()
anchor = "...(currentUser?.department === 'account_managers' || currentUser?.role === 'admin' ? [{ path: '/secured-cards', icon: CreditCard, label: 'Secured Cards' }] : []),"
addition = "\n    // AMs get Additional Rounds (Joe 8/4) - page's internal admin gates unchanged\n    ...(currentUser?.department === 'account_managers' && currentUser?.role !== 'admin' ? [{ path: '/admin/additional-rounds', icon: DollarSign, label: 'Additional Rounds' }] : []),"
n = s.count(anchor)
if n != 2: print(f"ABORTED: expected 2 nav anchors, found {n}"); sys.exit(1)
s = s.replace(anchor, anchor + addition)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("Additional Rounds tab added for AMs in BOTH nav menus")
