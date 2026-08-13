import glob, re
files = [f for f in glob.glob('netlify/functions/consultant-bonus*.js')]
print("builder files:", files)
for f in files:
    s = open(f, encoding='utf-8', errors='surrogateescape').read()
    if 'qualifiedDocs' not in s and 'docFeeOnly' not in s: continue
    print(f"\n########## {f} ({len(s)} chars) ##########")
    lines = s.split('\n')
    # print regions around qualification / journey / payments-assembly logic
    hits = [i for i, l in enumerate(lines) if re.search(r'qualifiedDocs|docFeeOnly|hasPaidPartial|journey|Journey|paidDocFee|payments\s*[:=]', l)]
    shown = set()
    for h in hits:
        for i in range(max(0, h-6), min(len(lines), h+7)):
            if i not in shown:
                shown.add(i)
                print(f"{i+1:5d}  {lines[i]}")
        print("   ...")
