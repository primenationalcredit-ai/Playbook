import glob, re
print("=== anthropic mentions in Playbook ===")
found = False
for f in glob.glob('netlify/functions/*.js') + glob.glob('src/**/*.jsx', recursive=True):
    s = open(f, encoding='utf-8', errors='surrogateescape').read()
    if re.search(r'anthropic|claude', s, re.I):
        found = True
        for i, l in enumerate(s.split('\n')):
            if re.search(r'anthropic|claude', l, re.I): print(f"  {f}:{i+1}: {l.strip()[:120]}")
if not found: print("  (none - fresh wiring)")
print()
print("=== session-auth + leadership-check pattern (crm-note-write.js) ===")
s = open('netlify/functions/crm-note-write.js', encoding='utf-8', errors='surrogateescape').read()
lines = s.split('\n')
hits = [i for i, l in enumerate(lines) if re.search(r'auth|token|session|user|leadership|department|Bearer|Authorization', l, re.I)]
shown = set()
for h in hits:
    for i in range(max(0, h-1), min(len(lines), h+2)):
        if i not in shown:
            shown.add(i)
            print(f"{i+1:5d}  {lines[i]}")
print()
print("=== how the frontend sends its session (ClientFile note composer) ===")
s2 = open('src/pages/ClientFile.jsx', encoding='utf-8', errors='surrogateescape').read()
lines2 = s2.split('\n')
hits2 = [i for i, l in enumerate(lines2) if re.search(r'crm-note-write|access_token|session|getSession', l)]
shown2 = set()
for h in hits2:
    for i in range(max(0, h-2), min(len(lines2), h+3)):
        if i not in shown2:
            shown2.add(i)
            print(f"{i+1:5d}  {lines2[i]}")
