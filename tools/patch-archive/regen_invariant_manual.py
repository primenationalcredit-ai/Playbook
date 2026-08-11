src = open('netlify/functions/invoice-mirror-invariant.js', encoding='utf-8', errors='surrogateescape').read()
hdr = "// MANUAL DOOR for invoice-mirror-invariant (scheduled functions 403 direct HTTP).\n"
open('netlify/functions/invoice-mirror-invariant-manual.js', 'w', encoding='utf-8', errors='surrogateescape', newline='').write(hdr + src)
print("manual door regenerated")
