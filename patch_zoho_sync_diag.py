import sys
f = 'netlify/functions/zoho-payment-sync-manual.js'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
a = "body: JSON.stringify({\n        month: targetMonth, page, paymentsScanned: payments.length,"
if s.count(a) != 1: print("ABORTED: response-body anchor x" + str(s.count(a))); sys.exit(1)
s = s.replace(a, "body: JSON.stringify({\n        month: targetMonth, page, paymentsScanned: payments.length, batchPreview: batch,", 1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
print("batchPreview added to manual-twin response (diagnostic only, twin file, original untouched)")
