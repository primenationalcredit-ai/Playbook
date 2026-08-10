# Kim's resend flow: (1) relay passes force through to the processor;
# (2) the Send Offer button, on "already exists", asks to void + resend
# and retries with force:true. Single-line / regex anchors (CRLF-safe).
import re, sys
fails = []

# --- relay: forward force ---
f1 = 'netlify/functions/ar-tracker.js'
s1 = open(f1, encoding='utf-8', errors='surrogateescape').read()
old1 = "body: JSON.stringify({ deal_id: dealId, skip_status_update: true })"
if s1.count(old1) != 1:
    fails.append(f"relay anchor x{s1.count(old1)}")
else:
    s1 = s1.replace(old1, "body: JSON.stringify({ deal_id: dealId, skip_status_update: true, force: body.force === true })", 1)
    open(f1, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s1)
    print("OK relay: force passes through")

# --- frontend: confirm + retry ---
f2 = 'src/pages/AdditionalRounds.jsx'
s2 = open(f2, encoding='utf-8', errors='surrogateescape').read()
pat = re.compile(r"const d = await r\.json\(\);(\r?\n\s*)setSendResult\(d\);")
m = pat.search(s2)
if not m:
    fails.append("frontend anchor not found")
else:
    nl = m.group(1)
    new2 = ("let d = await r.json();" + nl +
            "if (d && !d.success && String(d.error || '').includes('already exists') && window.confirm('An offer/invoice already exists for this deal:\\n\\n' + String(d.error) + '\\n\\nVoid the old invoice and resend a fresh offer?')) {" + nl +
            "  const r2 = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'send_offer', deal_id: id, force: true }) });" + nl +
            "  d = await r2.json();" + nl +
            "}" + nl +
            "setSendResult(d);")
    s2 = s2[:m.start()] + new2 + s2[m.end():]
    open(f2, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s2)
    print("OK frontend: confirm-and-force retry")

if fails:
    print("ABORTED:"); [print(" -", x) for x in fails]; sys.exit(1)
print("RESEND FLOW COMPLETE: button -> confirm -> void -> fresh offer")
