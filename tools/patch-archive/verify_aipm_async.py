import sys
ok = True
s = open('src/pages/LeadershipProjects.jsx', encoding='utf-8').read()
for n in ["pollStatus(j.nonce, 0)", "action: 'status', nonce", "Build failed:"]:
    if n not in s: ok = False; print(f"panel MISSING: {n}")
p = open('netlify/functions/ai-project-planner.js', encoding='utf-8').read()
for n in ["<CREATE_NOW>", "ai-project-builder-background", "action === 'status'", "max_tokens: 1500"]:
    if n not in p: ok = False; print(f"planner MISSING: {n}")
b = open('netlify/functions/ai-project-builder-background.js', encoding='utf-8').read()
for n in ["BUILD_SYSTEM", "saveStatus", "project_cards", "max_tokens: 8000"]:
    if n not in b: ok = False; print(f"builder MISSING: {n}")
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
if not ok: sys.exit(1)
