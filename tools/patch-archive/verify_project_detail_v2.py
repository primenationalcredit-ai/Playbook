s = open('src/pages/LeadershipProjects.jsx', encoding='utf-8').read()
ok = True
for n in ["ProjectDetail v2", "onSaveMeta", "commitNow", "Post an update", "SOP &amp; Files", "monthOf", "Tasks &amp; Timeline"]:
    if n not in s: ok = False; print(f"MISSING: {n}")
if "onEditDetails" in s: ok = False; print("popup wiring still present")
if s.count("function CardModal({") != 1: ok = False; print("CardModal count wrong")
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
