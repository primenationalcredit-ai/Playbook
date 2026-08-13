import sys
s = open('src/pages/LeadershipProjects.jsx', encoding='utf-8', errors='surrogateescape').read()
ok = "ordered.forEach(({ st, i }) => {" in s and "9999-12-31" in s and "steps.forEach((st, i) => {" not in s
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
if not ok: sys.exit(1)
