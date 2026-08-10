import sys
f = 'netlify/functions/watchdog-manual.js'
s = open(f, encoding='utf-8').read()
old = "  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || key !== process.env.SUPABASE_SERVICE_ROLE_KEY) {"
new = "  const okKeys = [process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.PIPEDRIVE_API_KEY].filter(Boolean);\n  if (!okKeys.length || !okKeys.includes(key)) {"
if s.count(old) != 1: print(f"ABORTED: gate anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("door gate: accepts service key OR Pipedrive key")
