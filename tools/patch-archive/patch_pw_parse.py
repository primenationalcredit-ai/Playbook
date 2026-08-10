import sys
f = 'netlify/functions/payment-webhook.js'
s = open(f, encoding='utf-8').read()
old = """  try {
    const body = JSON.parse(event.body || '{}');"""
new = """  try {
    // Zoho's webhook may deliver JSON or form-encoded (JSONString=... / raw params).
    // Parse permissively; a format we can't read is logged and skipped (200), never a 5xx.
    let body = {};
    const raw = event.body || '';
    try { body = JSON.parse(raw || '{}'); }
    catch (e1) {
      try {
        const params = new URLSearchParams(raw);
        const js = params.get('JSONString') || params.get('jsonstring');
        if (js) body = JSON.parse(js);
        else { body = {}; for (const [k, v] of params.entries()) body[k] = v; }
      } catch (e2) {
        console.log('[payment-webhook] unparseable body, skipping. first 300 chars:', String(raw).slice(0, 300));
        return { statusCode: 200, headers, body: JSON.stringify({ skipped: true, reason: 'unparseable body' }) };
      }
    }"""
if s.count(old) != 1: print(f"ABORTED: anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("PARSER HARDENED: JSON + form-encoded + Zoho JSONString all accepted; unreadable bodies logged+skipped")
