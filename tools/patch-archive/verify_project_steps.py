s = open('src/pages/LeadershipProjects.jsx', encoding='utf-8').read()
ok = True
for n in ["steps: Array.isArray(card?.steps)", "toggleStep", "Add a step and press Enter", "done_by"]:
    if n not in s: ok = False; print(f"MISSING: {n}")
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
