import sys
ok = True
p = open('netlify/functions/ai-project-planner.js', encoding='utf-8').read()
for n in ["invokeStatus = ir.status", "builder handoff failed", "nonce, creator, transcript"]:
    if n not in p: ok = False; print(f"planner MISSING: {n}")
if "key: BKEY" in p: ok = False; print("planner still sends BKEY")
b = open('netlify/functions/ai-project-builder-background.js', encoding='utf-8').read()
for n in ["unknown nonce", "stage: 'started'", "stage: 'generating'", "stage: 'parsing'", "stage: 'inserting'"]:
    if n not in b: ok = False; print(f"builder MISSING: {n}")
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
if not ok: sys.exit(1)
