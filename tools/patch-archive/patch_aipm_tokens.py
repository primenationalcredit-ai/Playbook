import sys
f = 'netlify/functions/ai-project-builder-background.js'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
a1 = "max_tokens: 8000,"
if s.count(a1) != 1: print(f"ABORTED: tokens anchor x{s.count(a1)}"); sys.exit(1)
s = s.replace(a1, "max_tokens: 16000,", 1)
a2 = """    const data = await r.json();
    await saveStatus(nonce, { status: 'building', stage: 'parsing' });"""
if s.count(a2) != 1: print(f"ABORTED: parse anchor x{s.count(a2)}"); sys.exit(1)
s = s.replace(a2, """    const data = await r.json();
    if (data.stop_reason === 'max_tokens') { await saveStatus(nonce, { status: 'error', error: 'project JSON exceeded the token budget - approve again (it usually fits on retry) or simplify the project' }); return { statusCode: 200, body: 'err saved' }; }
    await saveStatus(nonce, { status: 'building', stage: 'parsing' });""", 1)
a3 = "{ status: 'error', error: 'model JSON malformed - approve again to retry' }"
if s.count(a3) != 1: print(f"ABORTED: malformed anchor x{s.count(a3)}"); sys.exit(1)
s = s.replace(a3, "{ status: 'error', error: 'model JSON malformed (stop: ' + (data.stop_reason || '?') + ', tail: ' + text.slice(-80).replace(/\\s+/g, ' ') + ') - approve again to retry' }", 1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
print("builder: 16k tokens + truncation named + malformed shows tail")
