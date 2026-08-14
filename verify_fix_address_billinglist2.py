import sys
ok = True
s = open('src/pages/Invoices.jsx', encoding='utf-8', errors='surrogateescape').read()
if "const fixAddress = async" not in s: ok = False; print("function missing")
if "onClick={fixAddress}" not in s: ok = False; print("button not wired to function")
if "onFixAddress" in s: ok = False; print("dead prop-call leftover")
if s.count("'update_billing_address'") < 1: ok = False; print("callApi action missing")
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
if not ok: sys.exit(1)
