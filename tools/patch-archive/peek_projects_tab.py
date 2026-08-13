import glob, re, os
print("=== project-related files ===")
for f in glob.glob('src/**/*.jsx', recursive=True) + glob.glob('netlify/functions/*.js'):
    base = os.path.basename(f).lower()
    if 'project' in base:
        print(f"  {f} ({os.path.getsize(f)} chars)")
print()
print("=== routes + nav mentions ===")
for f in ['src/App.jsx', 'src/components/Layout.jsx']:
    try: s = open(f, encoding='utf-8', errors='surrogateescape').read()
    except: continue
    for i, l in enumerate(s.split('\n')):
        if re.search(r'project', l, re.I):
            print(f"  {f}:{i+1}: {l.strip()[:140]}")
print()
print("=== data model: what the page reads/writes ===")
pf = [f for f in glob.glob('src/**/*.jsx', recursive=True) if 'project' in os.path.basename(f).lower()]
if pf:
    s = open(pf[0], encoding='utf-8', errors='surrogateescape').read()
    lines = s.split('\n')
    hits = [i for i, l in enumerate(lines) if re.search(r'supabase|from\(|\.select|\.insert|\.update|useState\(|fetch\(|table|projects', l)]
    shown = set()
    for h in hits[:60]:
        for i in range(max(0, h-1), min(len(lines), h+2)):
            if i not in shown:
                shown.add(i)
                print(f"{i+1:5d}  {lines[i]}")
else:
    print("  (no project page found in src)")
