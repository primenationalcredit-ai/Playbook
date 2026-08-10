import sys
f = 'src/pages/Invoices.jsx'
s = open(f, encoding='utf-8').read()
old = ">Deal \\u2197</a>"
if s.count(old) != 1: print(f"ABORTED: anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, ">Deal \u2197</a>", 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("arrow renders properly now")
