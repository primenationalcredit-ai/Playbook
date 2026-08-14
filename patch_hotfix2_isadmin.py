import sys
f = 'src/pages/Invoices.jsx'
s = open(f, encoding='utf-8', errors='surrogateescape').read()

a1 = "function DeclineOutreachBar({ r }) {"
if s.count(a1) != 1: print("ABORTED: DeclineOutreachBar signature anchor x" + str(s.count(a1))); sys.exit(1)
s = s.replace(a1, "function DeclineOutreachBar({ r, isAdmin = false }) {", 1)
print("DeclineOutreachBar signature accepts isAdmin")

a2 = "{showDecline && <DeclineOutreachBar r={r} />}"
if s.count(a2) != 1: print("ABORTED: call-site anchor x" + str(s.count(a2))); sys.exit(1)
s = s.replace(a2, "{showDecline && <DeclineOutreachBar r={r} isAdmin={isAdmin} />}", 1)
print("call site now passes isAdmin")

open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)

# sanity check: confirm applyDiscount/isAdmin reference actually lives in THIS component now
i = s.find("function DeclineOutreachBar({ r, isAdmin = false }) {")
j = s.find("function ", i + 10)
body = s[i:j]
print("applyDiscount in DeclineOutreachBar body:", "applyDiscount" in body)
print("isAdmin reference in DeclineOutreachBar body:", "isAdmin &&" in body or "isAdmin ?" in body)
