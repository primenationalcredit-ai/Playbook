import sys
f = 'src/pages/LeadershipProjects.jsx'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
a = "steps.forEach((st, i) => {"
if s.count(a) != 1: print(f"ABORTED: anchor x{s.count(a)}"); sys.exit(1)
b = """// DATE-ORDER FIX (Joe 8/13): render sorted by due date (undated last, ties keep
                // original order); array order untouched so indices stay stable for edits.
                const ordered = steps.map((st, i) => ({ st, i })).sort((x, y) => {
                  const dx = x.st.due || '9999-12-31', dy = y.st.due || '9999-12-31';
                  return dx < dy ? -1 : dx > dy ? 1 : x.i - y.i;
                });
                ordered.forEach(({ st, i }) => {"""
s = s.replace(a, b, 1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
print("task table now renders in date order")
