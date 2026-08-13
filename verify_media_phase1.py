import sys
ok = True
s = open('src/pages/MediaLibrary.jsx', encoding='utf-8', errors='surrogateescape').read()
for n in ['return (', 'Add Video', 'toggleDept', 'showAdd &&', 'DEPTS.map']:
    if n not in s: ok = False; print('page missing: ' + n)
if s.count('export default function MediaLibrary') != 1: ok = False; print('component count off')
sa = open('src/App.jsx', encoding='utf-8', errors='surrogateescape').read()
if sa.count('<Route path="media"') != 1 or "import MediaLibrary" not in sa: ok = False; print('route missing')
sl = open('src/components/Layout.jsx', encoding='utf-8', errors='surrogateescape').read()
if "'/media'" not in sl: ok = False; print('nav missing')
if "Video" not in sl: ok = False; print('nav icon import missing')
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
if not ok: sys.exit(1)
