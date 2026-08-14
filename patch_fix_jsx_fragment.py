import sys
f = 'src/pages/Invoices.jsx'
s = open(f, encoding='utf-8', errors='surrogateescape').read()

pairs = [
    # (charge_now button, fix_address button) - wrap both in a fragment
    ("""<button onClick={() => onAction({ type: 'charge_now', charge_id: c.id, amount: c.amount, cardLast4: c.card_last_4 })}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-green-600 rounded hover:bg-green-700">
                  <Zap size={12} /> Charge Now
                </button>
                <button onClick={() => onAction({ type: 'fix_address', deal_id, client_name })}
                  title="Correct the billing address on file without touching the card itself"
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-asap-blue bg-white border border-asap-blue rounded hover:bg-blue-50">
                  <FileText size={12} /> Fix Address
                </button>""",
     """<>
                <button onClick={() => onAction({ type: 'charge_now', charge_id: c.id, amount: c.amount, cardLast4: c.card_last_4 })}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-green-600 rounded hover:bg-green-700">
                  <Zap size={12} /> Charge Now
                </button>
                <button onClick={() => onAction({ type: 'fix_address', deal_id, client_name })}
                  title="Correct the billing address on file without touching the card itself"
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-asap-blue bg-white border border-asap-blue rounded hover:bg-blue-50">
                  <FileText size={12} /> Fix Address
                </button>
              </>"""),
    # second copy (different indentation, from the AM/Consultant render path)
    ("""<button onClick={() => onAction({ type: 'charge_now', charge_id: c.id, amount: c.amount, cardLast4: c.card_last_4 })}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-green-600 rounded hover:bg-green-700">
                <Zap size={12} /> Charge Now
              </button>
              <button onClick={() => onAction({ type: 'fix_address', deal_id, client_name })}
                title="Correct the billing address on file without touching the card itself"
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-asap-blue bg-white border border-asap-blue rounded hover:bg-blue-50">
                <FileText size={12} /> Fix Address
              </button>""",
     """<>
              <button onClick={() => onAction({ type: 'charge_now', charge_id: c.id, amount: c.amount, cardLast4: c.card_last_4 })}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-green-600 rounded hover:bg-green-700">
                <Zap size={12} /> Charge Now
              </button>
              <button onClick={() => onAction({ type: 'fix_address', deal_id, client_name })}
                title="Correct the billing address on file without touching the card itself"
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-asap-blue bg-white border border-asap-blue rounded hover:bg-blue-50">
                <FileText size={12} /> Fix Address
              </button>
              </>"""),
]

found = 0
for old, new in pairs:
    c = s.count(old)
    if c == 1:
        s = s.replace(old, new, 1)
        found += 1
    elif c > 1:
        print("ABORTED: a pair matched " + str(c) + " times - ambiguous"); sys.exit(1)

if found == 0:
    print("ABORTED: neither pair pattern matched - paste current file section, whitespace likely differs"); sys.exit(1)

open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
print("wrapped " + str(found) + " of 2 button-pairs in fragments")
