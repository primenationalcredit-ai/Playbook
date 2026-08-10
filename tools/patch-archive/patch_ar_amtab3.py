import sys
f = 'src/components/Layout.jsx'
s = open(f, encoding='utf-8').read()
old = "    ...(isAM ? [{ path: '/approvals', icon: ShieldCheck, label: 'Approvals', badge: amApprovalsBadge, unread: approvalsUnread }] : []),"
new = """    ...(isAM ? [{ path: '/approvals', icon: ShieldCheck, label: 'Approvals', badge: amApprovalsBadge, unread: approvalsUnread }] : []),
    // AMs get Additional Rounds (Joe 8/4) - THIS array is what regular AMs
    // actually render (departmentItems = isJoe ? [...] : coreDepartmentItems);
    // the earlier inserts sat in leadership-only arrays and never showed.
    ...(isAccountManagerDept ? [{ path: '/admin/additional-rounds', icon: DollarSign, label: 'Additional Rounds' }] : []),
    ...(isAccountManagerDept ? [{ path: '/secured-cards', icon: CreditCard, label: 'Secured Cards' }] : []),"""
if s.count(old) != 1: print(f"ABORTED: core anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("Additional Rounds (+ Secured Cards, same bug) now in the array AMs actually render")
