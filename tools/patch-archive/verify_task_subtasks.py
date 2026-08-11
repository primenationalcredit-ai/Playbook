import sys
s = open('src/pages/LeadershipProjects.jsx', encoding='utf-8').read()
ok = True
for n in ["setExpanded(expanded === i ? null : i)", "toggleSub", "st.test_url", "What to do", "Add a subtask and press Enter"]:
    if n not in s: ok = False; print(f"MISSING: {n}")
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
if not ok: sys.exit(1)
