import sys
f = 'src/components/Layout.jsx'
s = open(f, encoding='utf-8').read()
old = "    ...((isConsultant && !isLeadership) ? [{ path: '/affiliate-outreach', icon: Users2, label: 'Affiliates', badge: affiliateCallsDue, unread: affiliateCallsOverdue }] : []),"
new = "    ...((isConsultant && !isLeadership && !isAccountManagerDept) ? [{ path: '/affiliate-outreach', icon: Users2, label: 'Affiliates', badge: affiliateCallsDue, unread: affiliateCallsOverdue }] : []),"
if s.count(old) != 1: print(f"ABORTED: affiliates anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("Affiliates tab removed from account managers - consultants keep it")
