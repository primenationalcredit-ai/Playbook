import sys
b = open('netlify/functions/ai-project-builder-background.js', encoding='utf-8').read()
ok = True
for n in ["max_tokens: 16000", "stop_reason === 'max_tokens'", "tail: ' + text.slice(-80)"]:
    if n not in b: ok = False; print(f"MISSING: {n}")
if "max_tokens: 8000" in b: ok = False; print("old 8000 cap still present")
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
if not ok: sys.exit(1)
