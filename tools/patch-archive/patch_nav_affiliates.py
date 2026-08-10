import sys
f = 'src/components/Layout.jsx'
s = open(f, encoding='utf-8').read()
old = """  const coreDepartmentItems = [
    ...(isConsultant ? [{ path: '/payments', icon: DollarSign, label: 'Payment Dashboard' }] : []),"""
new = """  const coreDepartmentItems = [
    ...((isConsultant && !isLeadership) ? [{ path: '/affiliate-outreach', icon: Users2, label: 'Affiliates', badge: affiliateCallsDue, unread: affiliateCallsOverdue }] : []),
    ...(isConsultant ? [{ path: '/payments', icon: DollarSign, label: 'Payment Dashboard' }] : []),"""
if s.count(old) != 1: print(f"ABORTED: anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("AFFILIATES ADDED to consultant core nav (leadership excluded here - they have it in their own menu)")
