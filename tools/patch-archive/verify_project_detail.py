s = open('src/pages/LeadershipProjects.jsx', encoding='utf-8').read()
ok = True
for n in ["function ProjectDetail", "openProjectId", "pd-assignees", "onSaveSteps", "Back to board", "setOpenProjectId(card.id)"]:
    if n not in s: ok = False; print(f"MISSING: {n}")
if s.count("function CardModal({") != 1: ok = False; print("CardModal duplicated or missing")
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
