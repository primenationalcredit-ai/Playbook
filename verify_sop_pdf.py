import sys
ok = True
t = open('netlify/functions/sop-pdf-background.js', encoding='utf-8').read()
for n in ['buildSopPdf', 'sop-pdfs', 'pdf_url', 'x-upsert', 'startxref']:
    if n not in t: ok = False; print('fn missing: ' + n)
s = open('src/pages/SopLibrary.jsx', encoding='utf-8', errors='surrogateescape').read()
if s.count('sop-pdf-background') != 1: ok = False; print('load fire missing')
if 'pdf_url' not in s: ok = False; print('button missing')
if 'Download' not in s: ok = False; print('icon import missing')
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
if not ok: sys.exit(1)
