import sys
s = open('netlify/functions/zoho-payment-sync-manual.js', encoding='utf-8', errors='surrogateescape').read()
ok = 'batchPreview: batch' in s
orig = open('netlify/functions/zoho-payment-sync.js', encoding='utf-8', errors='surrogateescape').read()
if 'batchPreview' in orig: ok = False; print("ORIGINAL was touched - abort")
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
sys.exit(0 if ok else 1)
