import sys
f = 'netlify/functions/payment-webhook.js'
s = open(f, encoding='utf-8').read()
old = """    if (!body.client_name || !body.amount || !body.consultant_name) {
      return { statusCode: 400, headers, body: JSON.stringify({ 
        error: 'Missing required fields: client_name, amount, consultant_name',
        received: Object.keys(body)
      })};
    }"""
new = """    if (!body.client_name || !body.amount || !body.consultant_name) {
      // Acknowledge with 200 so Zoho doesn't count this as a webhook failure and
      // deactivate us (7/29 warning email). Test invoices and events without a
      // consultant field land here; they're logged and skipped, not errors.
      console.log('[payment-webhook] skipped - missing fields', JSON.stringify({ received: Object.keys(body), client: body.client_name || null, amount: body.amount || null }));
      return { statusCode: 200, headers, body: JSON.stringify({
        skipped: true, reason: 'Missing required fields: client_name, amount, consultant_name',
        received: Object.keys(body)
      })};
    }"""
if s.count(old) != 1: print(f"ABORTED: anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("WEBHOOK HEALTH FIX APPLIED")
