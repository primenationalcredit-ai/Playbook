import sys, re
src = open('netlify/functions/qualified-doc-watchdog.js', encoding='utf-8').read()
# Take everything except the exports.handler line, then re-expose under a new name
if 'exports.handler = async (event)' not in src: print("ABORTED: watchdog shape changed"); sys.exit(1)
body = src.replace('exports.handler = async (event) =>', 'const runWatchdog = async (event) =>')
wrapper = body + """
// ---- Manual door (inlined; cross-function require breaks under esbuild) ----
exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  const key = (event.headers && (event.headers['x-api-key'] || event.headers['X-API-Key'])) || '';
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || key !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  try { return await runWatchdog(event); }
  catch (err) { return { statusCode: 200, headers, body: JSON.stringify({ wrapper_error: String(err && err.stack || err).slice(0, 800) }) }; }
};
"""
open('netlify/functions/watchdog-manual.js', 'w', encoding='utf-8', newline='').write(wrapper)
print("manual door rebuilt: full watchdog inlined, no require")
