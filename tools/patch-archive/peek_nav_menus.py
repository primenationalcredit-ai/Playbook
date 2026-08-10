s = open('src/components/Layout.jsx', encoding='utf-8', errors='surrogateescape').read()
start = 0
n = 0
while True:
    i = s.find("path: '/clients'", start)
    if i < 0: break
    n += 1
    print(f"===== OCCURRENCE {n} at offset {i} — 1200 chars before: =====")
    print(s[max(0, i-1200):i])
    print("===== and 200 after: =====")
    print(s[i:i+200])
    start = i + 1
print(f"(total: {n})")
