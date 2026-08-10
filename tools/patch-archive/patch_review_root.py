# ROOT CAUSE (Carlos ticket): Add Review sends a 'platform' field that is NOT
# a column in incoming_reviews -> every manual submission 400s (PGRST204) -
# and the error check tested result.error while Supabase returns
# {code,message}, so the failure was treated as success. Fix both.
import sys
f = 'src/pages/Reviews.jsx'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
fails = []
def rep(tag, old, new):
    global s
    n = s.count(old)
    if n != 1: fails.append(f"{tag}: x{n}"); return
    s = s.replace(old, new); print(f"OK {tag}")

rep('drop-platform', "        platform: formData.platform,\n", "")
rep('error-shape',
"      if (result && result.error) {",
"      if (result && (result.error || result.code)) {")

if fails:
    # CRLF fallback for the platform line
    if s.count("        platform: formData.platform,\r\n") == 1:
        s = s.replace("        platform: formData.platform,\r\n", "", 1)
        print("OK drop-platform (crlf)")
        fails = [x for x in fails if not x.startswith('drop-platform')]
    if fails:
        print("ABORTED:"); [print(" -", x) for x in fails]; sys.exit(1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
print("ADD REVIEW FIXED: no phantom column, real errors caught")
