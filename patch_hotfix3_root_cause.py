import sys
f = 'src/pages/Invoices.jsx'
s = open(f, encoding='utf-8', errors='surrogateescape').read()

a1 = "function BillingOverview() {"
if s.count(a1) != 1: print("ABORTED: BillingOverview signature anchor x" + str(s.count(a1))); sys.exit(1)
s = s.replace(a1, "function BillingOverview({ isAdmin }) {", 1)
print("BillingOverview now accepts isAdmin as a required prop")

a2 = "<BillingOverview />"
if s.count(a2) != 1: print("ABORTED: call-site anchor x" + str(s.count(a2))); sys.exit(1)
s = s.replace(a2, "<BillingOverview isAdmin={isAdmin} />", 1)
print("call site now passes isAdmin")

open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
