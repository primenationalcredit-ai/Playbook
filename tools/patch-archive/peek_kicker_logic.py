import glob, re
print("=== where the Reactivation Kicker logic lives ===")
for f in glob.glob('netlify/functions/*.js') + glob.glob('src/**/*.jsx', recursive=True):
    s = open(f, encoding='utf-8', errors='surrogateescape').read()
    if re.search(r'kicker|reactivat', s, re.I):
        lines = s.split('\n')
        hits = [i for i, l in enumerate(lines) if re.search(r'kicker|reactivat', l, re.I)]
        print(f"--- {f} ({len(hits)} hits) ---")
        shown = set()
        for h in hits:
            for i in range(max(0, h-2), min(len(lines), h+3)):
                if i not in shown:
                    shown.add(i)
                    print(f"{i+1:5d}  {lines[i][:150]}")
