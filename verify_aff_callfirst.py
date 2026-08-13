import sys, re
ok = True
s = open('src/pages/AffiliateOutreach.jsx', encoding='utf-8', errors='surrogateescape').read()
if "useState('calls')" not in s: ok = False; print("default tab not calls")
if s.count("useState('book')") != 0: ok = False; print("old default still present")
if not re.search(r"\{\w+ && \(<button onClick=\{\(\) => setTab\('messages'\)\}", s): ok = False; print("messages tab not leadership-wrapped")
if s.count("tel:") < 3: ok = False; print("tel links count: " + str(s.count("tel:")))
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
if not ok: sys.exit(1)
