import sys
ok = True
s1 = open('netlify/functions/ai-sop.js', encoding='utf-8', errors='surrogateescape').read()
if "label: `SOP v${version}`" not in s1: ok = False; print("ai-sop.js: label field missing")
s2 = open('src/pages/LeadershipProjects.jsx', encoding='utf-8', errors='surrogateescape').read()
for n in ["l.sop ? (", "l.label || l.name", "{l.content}"]:
    if n not in s2: ok = False; print("jsx: missing " + n)
if s2.count("href={l.url}") != 1: ok = False; print("anchor count " + str(s2.count("href={l.url}")) + " (expected 1)")
if s2.count("<details className=\"flex-1 min-w-0\">") != 1: ok = False; print("viewer duplicated")
if s2.count("<details") != s2.count("</details>"): ok = False; print("details tags unbalanced")
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
if not ok: sys.exit(1)
