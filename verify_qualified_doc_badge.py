import sys
ok = True
s = open('src/pages/Invoices.jsx', encoding='utf-8', errors='surrogateescape').read()
checks = [
    ("qualifiedDoc }) {", 1, "DealView signature"),
    ("Qualified Doc</span>", 1, "badge text - qualified case"),
    ("Not a Qualified Doc</span>", 1, "badge text - not-qualified case"),
    ("const [qualifiedDoc, setQualifiedDoc] = useState(null);", 1, "state declaration"),
    ("check_qualified_doc", 2, "callApi action name (fire + reset context)"),
    ("setQualifiedDoc(null); setMode('browse');", 1, "reset wiring"),
    ("qualifiedDoc={qualifiedDoc} />", 1, "call-site prop pass"),
]
for needle, expect_min, label in checks:
    n = s.count(needle)
    if n < expect_min:
        ok = False
        print(f"SHORT: '{needle}' found {n}x, expected >= {expect_min} ({label})")
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
sys.exit(0 if ok else 1)
