import sys
f = 'src/pages/AdditionalRounds.jsx'
s = open(f, encoding='utf-8').read()
old = "Later: <b>${'{'}splitSecond.toFixed(2){'}'}</b> on"
new = "Later: <b>${splitSecond.toFixed(2)}</b> on"
if s.count(old) != 1: print(f"ABORTED: label anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("Later-amount now renders the real number")
