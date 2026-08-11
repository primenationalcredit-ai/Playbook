import sys
ok = True
s = open('src/pages/LeadershipProjects.jsx', encoding='utf-8').read()
for n in ["function ProjectAIPanel", "ai-project-assistant", "card_id: card.id", "setAiPanel(true)", "onSaveMeta({ phase: ph })", "onReload={() => loadData()}", "key={pc.updated_at || pc.id}"]:
    if n not in s: ok = False; print(f"UI MISSING: {n}")
a = open('netlify/functions/ai-project-assistant.js', encoding='utf-8').read()
for n in ["<OPS>", "task_set", "sub_set", "op === 'update'", "Leadership only", "max_tokens: 2500"]:
    if n not in a: ok = False; print(f"fn MISSING: {n}")
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
if not ok: sys.exit(1)
