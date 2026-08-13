import sys
s = open('netlify/functions/ai-project-assistant.js', encoding='utf-8', errors='surrogateescape').read()
ok = "postedOwnUpdate" in s and "Applied: " in s and s.count("patch.updates = updates;") == 1
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
if not ok: sys.exit(1)
