import glob, re, os
cands = []
for f in glob.glob('src/**/*.jsx', recursive=True) + glob.glob('src/**/*.js', recursive=True) + glob.glob('netlify/functions/*.js'):
    try: s = open(f, encoding='utf-8', errors='surrogateescape').read()
    except: continue
    score = len(re.findall(r'call queue|callQueue|call_queue|CallQueue', s, re.I))
    aff = len(re.findall(r'affiliate', s, re.I))
    if score or (aff > 3 and re.search(r'queue', s, re.I)):
        cands.append((score + aff, f, len(s)))
cands.sort(reverse=True)
print("candidate files:")
for sc, f, ln in cands[:8]: print(f"  {f} (score {sc}, {ln} chars)")
# print queue-related regions of the top candidate page (not function)
pages = [f for _, f, _ in cands if f.startswith('src')]
if pages:
    f = pages[0]
    s = open(f, encoding='utf-8', errors='surrogateescape').read()
    print(f"\n########## {f} ##########")
    lines = s.split('\n')
    hits = [i for i, l in enumerate(lines) if re.search(r'queue|Queue|completed|Completed|done|Done|called|localStorage|sessionStorage|useState\(|useEffect\(|supabase\.', l)]
    shown = set()
    for h in hits:
        for i in range(max(0, h-2), min(len(lines), h+3)):
            if i not in shown:
                shown.add(i)
                print(f"{i+1:5d}  {lines[i]}")
