import sys
src = 'netlify/functions/zoho-payment-sync.js'
s = open(src, encoding='utf-8', errors='surrogateescape').read()

# add a key check right after the handler opens, and write as a differently-named twin
a = "exports.handler = async ("
idx = s.find(a)
if idx == -1: print("ABORTED: handler start not found"); sys.exit(1)
# find the opening brace of the function body to insert the key check right after it
brace_idx = s.find("{", idx)
if brace_idx == -1: print("ABORTED: opening brace not found"); sys.exit(1)
key_check = """
  const _key = (event.headers && (event.headers['x-api-key'] || event.headers['X-API-Key'])) || (event.queryStringParameters && event.queryStringParameters.key);
  if (!_key || _key !== process.env.INTERNAL_API_KEY) return { statusCode: 401, body: JSON.stringify({ error: 'Invalid API key' }) };
"""
new_s = s[:brace_idx+1] + key_check + s[brace_idx+1:]
header = "// netlify/functions/zoho-payment-sync-manual.js - keyed on-demand twin (Joe 8/14, Nathan Reyes 253584: AR payment missing from consultant_payments, needed a way to fire this on demand instead of guessing at scheduled-run behavior - same pattern as every other -manual door built tonight, since Netlify blocks direct HTTP on functions registered with a schedule regardless of the function's own code). Identical logic to the scheduled original.\n"
new_s = header + new_s
open('netlify/functions/zoho-payment-sync-manual.js', 'w', encoding='utf-8', errors='surrogateescape', newline='').write(new_s)
print("manual twin written")
