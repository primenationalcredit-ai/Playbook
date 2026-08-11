import sys
f = 'netlify/functions/ai-project-planner.js'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
old = """      // hand off to the background builder (15-min limit); invocation returns 202 fast
      await fetch(`${SITE}/.netlify/functions/ai-project-builder-background`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: BKEY, nonce, creator, transcript: [...messages, { role: 'assistant', content: reply }] })
      }).catch(e => console.error('builder invoke failed:', e.message));
      return respond(200, { reply: reply || 'Building your project now - this takes about a minute.', creating: true, nonce });"""
new = """      // hand off to the background builder (15-min limit). Auth = the nonce row
      // itself (only this session-authed function creates it). Record the invoke
      // status so a failed handoff is visible instead of silently stuck.
      let invokeStatus = 0;
      try {
        const ir = await fetch(`${SITE}/.netlify/functions/ai-project-builder-background`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nonce, creator, transcript: [...messages, { role: 'assistant', content: reply }] })
        });
        invokeStatus = ir.status;
      } catch (e) { console.error('builder invoke failed:', e.message); }
      if (invokeStatus >= 300 || invokeStatus === 0) {
        await fetch(`${SU}/rest/v1/app_cache`, { method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify({ cache_key: 'aipm_' + nonce, cache_value: JSON.stringify({ status: 'error', error: `builder handoff failed (http ${invokeStatus}) - approve again to retry` }), updated_at: new Date().toISOString() }) });
      }
      return respond(200, { reply: reply || 'Building your project now - this takes about a minute.', creating: true, nonce });"""
if s.count(old) != 1: print(f"ABORTED: handoff anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
print("planner: nonce-auth handoff + visible invoke status")
