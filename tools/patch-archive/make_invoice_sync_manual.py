import sys, re
src = open('netlify/functions/zoho-invoice-sync.js', encoding='utf-8', errors='surrogateescape').read()
# strip any inline schedule config so the copy is a plain HTTP function
src = re.sub(r"exports\.config\s*=\s*\{[^}]*schedule[^}]*\};?\s*", "", src)
hdr = "// MANUAL DOOR for zoho-invoice-sync (scheduled functions 403 direct HTTP - known gotcha).\n// Identical logic, HTTP-invokable, for targeted window re-walks like Elizabeth Ferguson 268497.\n"
open('netlify/functions/zoho-invoice-sync-manual.js', 'w', encoding='utf-8', errors='surrogateescape', newline='').write(hdr + src)
print("manual door written")
