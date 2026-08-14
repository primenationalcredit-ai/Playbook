import sys
f = 'src/pages/Invoices.jsx'
s = open(f, encoding='utf-8', errors='surrogateescape').read()

# ---- 1) BillingRow signature: accept isAdmin ----
a1 = "function BillingRow({ r, showDecline }) {"
if s.count(a1) != 1: print("ABORTED: BillingRow signature anchor x" + str(s.count(a1))); sys.exit(1)
s = s.replace(a1, "function BillingRow({ r, showDecline, isAdmin = false }) {", 1)
print("BillingRow signature accepts isAdmin")

# ---- 2) call site: pass isAdmin down ----
a2 = "<BillingRow r={r} showDecline={showDecline} />"
if s.count(a2) != 1: print("ABORTED: call-site anchor x" + str(s.count(a2))); sys.exit(1)
s = s.replace(a2, "<BillingRow r={r} showDecline={showDecline} isAdmin={isAdmin} />", 1)
print("call site now passes isAdmin")

open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
