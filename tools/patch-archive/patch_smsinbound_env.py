# affiliate-sms-inbound guessed env names that don't exist on the cute-cat
# site -> DB lookups unauthenticated -> "no affiliate match" always.
# Mirror affiliate-cadence-runner's names exactly.
import sys
f = 'netlify/functions/affiliate-sms-inbound.js'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
fails = []
def rep(tag, old, new):
    global s
    n = s.count(old)
    if n != 1: fails.append(f"{tag}: x{n}"); return
    s = s.replace(old, new); print(f"OK {tag}")

rep('url', "const SUPABASE_URL = process.env.SUPABASE_URL;",
    "const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;")
rep('key', "const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;",
    "const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;")

if fails:
    print("ABORTED:"); [print(" -", x) for x in fails]; sys.exit(1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
print("ENV NAMES MATCH THE SITE - DB LEG AUTHENTICATED")
