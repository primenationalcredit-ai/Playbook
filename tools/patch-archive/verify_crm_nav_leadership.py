import sys
l = open('src/components/Layout.jsx', encoding='utf-8', errors='surrogateescape').read()
ok = True
for p in ["/clients", "/my-day", "/pipelines", "/my-book"]:
    c = l.count(f"path: '{p}'")
    if c != 1: ok = False; print(f"{p}: x{c}, expected exactly 1 (leadership menu only)")
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
sys.exit(0 if ok else 1)
