import sys
def abort(m):
    print("ABORTED: " + m); sys.exit(1)

# ===== File 1: App.jsx - open the route to any logged-in user, component handles the rest =====
f = "src/App.jsx"
s = open(f, encoding="utf-8", errors="surrogateescape").read()
a1 = """        <Route path="admin/refunds" element={
          <ProtectedRoute adminOnly>
            <RefundTracking />
          </ProtectedRoute>
        } />"""
if s.count(a1) != 1: abort(f + " anchor1 x" + str(s.count(a1)))
b1 = """        <Route path="admin/refunds" element={
          <ProtectedRoute>
            <RefundTracking />
          </ProtectedRoute>
        } />"""
s = s.replace(a1, b1, 1)
open(f, "w", encoding="utf-8", errors="surrogateescape", newline="").write(s)
print(f + " patched")

# ===== File 2: Layout.jsx - add the nav tab for AMs and Consultants, both places =====
f = "src/components/Layout.jsx"
s = open(f, encoding="utf-8", errors="surrogateescape").read()
a2 = """    ...(isAccountManagerDept ? [{ path: '/admin/additional-rounds', icon: DollarSign, label: 'Additional Rounds' }] : []),
    ...(isLeadership ? [{ path: '/admin/automations', icon: ShieldCheck, label: 'Automations' }] : []),"""
if s.count(a2) != 1: abort(f + " anchor2 x" + str(s.count(a2)))
b2 = """    ...(isAccountManagerDept ? [{ path: '/admin/additional-rounds', icon: DollarSign, label: 'Additional Rounds' }] : []),
    // AMs and Consultants get their own Refund Tracking view (Joe 8/18) - the page
    // itself narrows admin actions and other people's requests for non-leadership.
    ...((isAccountManagerDept || isConsultant) ? [{ path: '/admin/refunds', icon: DollarSign, label: 'Refund Tracking' }] : []),
    ...(isLeadership ? [{ path: '/admin/automations', icon: ShieldCheck, label: 'Automations' }] : []),"""
s = s.replace(a2, b2, 1)

a3 = """    ...(currentUser?.department === 'account_managers' && currentUser?.role !== 'admin' ? [{ path: '/admin/additional-rounds', icon: DollarSign, label: 'Additional Rounds' }] : []),
    ...(isConsultant ? [{ path: '/paysheet', icon: Receipt, label: 'My Paysheet' }] : []),"""
if s.count(a3) != 1: abort(f + " anchor3 x" + str(s.count(a3)))
b3 = """    ...(currentUser?.department === 'account_managers' && currentUser?.role !== 'admin' ? [{ path: '/admin/additional-rounds', icon: DollarSign, label: 'Additional Rounds' }] : []),
    ...((currentUser?.department === 'account_managers' || isConsultant) && currentUser?.role !== 'admin' ? [{ path: '/admin/refunds', icon: DollarSign, label: 'Refund Tracking' }] : []),
    ...(isConsultant ? [{ path: '/paysheet', icon: Receipt, label: 'My Paysheet' }] : []),"""
s = s.replace(a3, b3, 1)
open(f, "w", encoding="utf-8", errors="surrogateescape", newline="").write(s)
print(f + " patched")

# ===== File 3: RefundTracking.jsx - non-leadership users only see their own submissions =====
f = "src/pages/RefundTracking.jsx"
s = open(f, encoding="utf-8", errors="surrogateescape").read()
a4 = """  const open = reqs.filter(r => OPEN_STATUSES.includes(r.status));
  const done = reqs.filter(r => DONE_STATUSES.includes(r.status)).slice(0, 25);"""
if s.count(a4) != 1: abort(f + " anchor4 x" + str(s.count(a4)))
b4 = """  // Non-leadership (AMs/Consultants) only see their own submissions (Joe 8/18) -
  // leadership keeps the full company-wide view for approve/deny.
  const myReqs = isLeader ? reqs : reqs.filter(r => r.requested_by === currentUser?.email);
  const open = myReqs.filter(r => OPEN_STATUSES.includes(r.status));
  const done = myReqs.filter(r => DONE_STATUSES.includes(r.status)).slice(0, 25);"""
s = s.replace(a4, b4, 1)
open(f, "w", encoding="utf-8", errors="surrogateescape", newline="").write(s)
print(f + " patched")

print("ALL 3 FILES PATCHED")
