import sys
ok = True
s = open('src/pages/Invoices.jsx', encoding='utf-8', errors='surrogateescape').read()
if "function BillingRow({ r, showDecline, isAdmin = false }) {" not in s: ok = False; print("signature fix missing")
if "<BillingRow r={r} showDecline={showDecline} isAdmin={isAdmin} />" not in s: ok = False; print("call-site fix missing")
if "function BillingRow({ r, showDecline }) {" in s: ok = False; print("OLD signature still present somewhere")
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
sys.exit(0 if ok else 1)
