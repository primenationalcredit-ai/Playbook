import sys
ok = True
t = open('netlify/functions/media-describe-background.js', encoding='utf-8').read()
for n in ['ai_summary=is.null', 'claude-sonnet-4-5', 'anthropic-version', 'media_folders']:
    if n not in t: ok = False; print('fn missing: ' + n)
s = open('src/pages/MediaLibrary.jsx', encoding='utf-8', errors='surrogateescape').read()
if s.count('media-describe-background') != 1: ok = False; print('trigger not wired')
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
if not ok: sys.exit(1)
