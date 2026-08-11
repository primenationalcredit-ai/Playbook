import sys
s = open('src/pages/LeadershipProjects.jsx', encoding='utf-8').read()
ok = True
for n in ["function AIPlannerPanel", "ai-project-planner", "setAiOpen(true)", "aiOpen && <AIPlannerPanel", "supabase.auth.getSession"]:
    if n not in s: ok = False; print(f"MISSING: {n}")
if s.count("function ProjectDetail({") != 1: ok = False; print("ProjectDetail count wrong")
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
if not ok: sys.exit(1)
