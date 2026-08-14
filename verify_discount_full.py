import sys
ok = True
s = open('src/pages/Invoices.jsx', encoding='utf-8', errors='surrogateescape').read()
checks = [
    ("type: 'discount'", 3, "deal-lookup Discount buttons + submit branch"),
    ("modal.type === 'discount'", 2, "modal-body + submit dispatch"),
    ("apply_discount", 2, "callApi action name (deal-lookup + BillingList)"),
    ("applyDiscount", 2, "BillingList function def + button onClick"),
    ("isAdmin={isAdmin}", 3, "BillingList call sites"),
    ("isAdmin = false", 1, "BillingList signature default"),
]
for needle, expect_min, label in checks:
    n = s.count(needle)
    if n < expect_min:
        ok = False
        print(f"SHORT: '{needle}' found {n}x, expected >= {expect_min} ({label})")
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
sys.exit(0 if ok else 1)
