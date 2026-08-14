import sys
ok = True
t = open('netlify/functions/zoho-payment-sync-manual.js', encoding='utf-8', errors='surrogateescape').read()
if "process.env.INTERNAL_API_KEY" not in t: ok = False; print("twin: key check missing")
if "exports.handler" not in t: ok = False; print("twin: handler missing")
s = open('netlify/functions/zoho-payment-sync.js', encoding='utf-8', errors='surrogateescape').read()
if "INTERNAL_API_KEY" in s: ok = False; print("ORIGINAL was modified - abort")
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
sys.exit(0 if ok else 1)
