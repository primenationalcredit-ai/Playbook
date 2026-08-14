import sys
f = 'src/pages/Invoices.jsx'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
a = """              <button onClick={() => onAction({ type: 'charge_now', charge_id: c.id, amount: c.amount, cardLast4: c.card_last_4 })}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-green-600 rounded hover:bg-green-700">
                <Zap size={12} /> Charge Now
              </button>"""
if s.count(a) != 1: print("ABORTED: second charge_now block anchor x" + str(s.count(a))); sys.exit(1)
btn = a + """
              <button onClick={() => onAction({ type: 'fix_address', deal_id, client_name })}
                title="Correct the billing address on file without touching the card itself"
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-asap-blue bg-white border border-asap-blue rounded hover:bg-blue-50">
                <FileText size={12} /> Fix Address
              </button>"""
s = s.replace(a, btn, 1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
print("second Fix Address button added")
