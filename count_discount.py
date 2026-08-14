s = open('src/pages/Invoices.jsx', encoding='utf-8', errors='surrogateescape').read()
for needle in ["type: 'discount'", "modal.type === 'discount'", "apply_discount", "applyDiscount", "isAdmin={isAdmin}", "Discount"]:
    print(needle, "->", s.count(needle))
