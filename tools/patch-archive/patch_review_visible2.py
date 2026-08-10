# v2 (CRLF-safe): single-line anchor. Adds an on-screen alert to the Add
# Review catch so thrown failures can never be silent again.
import sys
f = 'src/pages/Reviews.jsx'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
old = "console.error('Error adding review:', error);"
new = "console.error('Error adding review:', error);\n      alert('Error adding review - it was NOT saved: ' + (error && error.message ? error.message : error) + ' -- please try again, and report it if it keeps happening.');"
n = s.count(old)
if n != 1:
    print(f"ABORT: anchor x{n}")
    for i, ln in enumerate(s.split('\n'), 1):
        if 'Error adding review' in ln: print(f"{i}: {ln.rstrip()}")
    sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
print("ADD-REVIEW FAILURES NOW ALERT ON SCREEN (v2)")
