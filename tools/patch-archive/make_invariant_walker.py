import sys
src = open('netlify/functions/invoice-mirror-invariant.js', encoding='utf-8', errors='surrogateescape').read()
hdr = "// MANUAL DOOR for invoice-mirror-invariant (scheduled functions 403 direct HTTP).\n"
open('netlify/functions/invoice-mirror-invariant-manual.js', 'w', encoding='utf-8', errors='surrogateescape', newline='').write(hdr + src)
t = open('netlify.toml', encoding='utf-8', errors='surrogateescape').read()
if 'invoice-mirror-invariant' not in t:
    t = t.rstrip('\n') + '\n\n[functions."invoice-mirror-invariant"]\n  schedule = "30 4 * * *"\n'
    open('netlify.toml', 'w', encoding='utf-8', errors='surrogateescape', newline='').write(t)
    print("toml: nightly 4:30am UTC (~10:30pm CT) schedule added")
else:
    print("toml: schedule already present")
