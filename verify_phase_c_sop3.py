import sys
ok = True
for f, needles in [
  ('netlify/functions/ai-sop.js', ["action === 'start'", "action === 'status'", "action === 'approve'", "requireLeader"]),
  ('netlify/functions/ai-sop-background.js', ["body.key !== BKEY", "claude-sonnet-4-5", "status: 'done', draft"]),
  ('src/pages/LeadershipProjects.jsx', ["genSOP", "approveSOP", "Generate SOP", "Approve and Attach", "setSopDraft(pj.draft"]),
]:
    s = open(f, encoding='utf-8', errors='surrogateescape').read()
    for n in needles:
        if n not in s: ok = False; print(f + ": missing " + n)
s = open('src/pages/LeadershipProjects.jsx', encoding='utf-8', errors='surrogateescape').read()
if s.count("const genSOP") != 1: ok = False; print("genSOP defined " + str(s.count("const genSOP")) + " times")
if s.count("onClick={genSOP}") != 1: ok = False; print("SOP button rendered " + str(s.count("onClick={genSOP}")) + " times")
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
if not ok: sys.exit(1)
