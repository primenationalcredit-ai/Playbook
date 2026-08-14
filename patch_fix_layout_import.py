import sys
f = 'src/components/Layout.jsx'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
bad = "\n  , Video } from 'lucide-react';"
if bad not in s:
    # try without leading newline/spacing assumption - broader match
    import re
    m = re.search(r"[,\s]*\n\s*, Video \} from 'lucide-react';", s)
    if not m:
        print("ABORTED: could not locate the malformed import pattern - paste the peek output"); sys.exit(1)
    s = s[:m.start()] + ", Video } from 'lucide-react';" + s[m.end():]
else:
    s = s.replace(bad, ", Video } from 'lucide-react';", 1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
print("import fixed")
