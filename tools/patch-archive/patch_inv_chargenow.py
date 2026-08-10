import sys
f = 'src/pages/Invoices.jsx'
s = open(f, encoding='utf-8').read()

old = """          <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-2 items-center">
            {SPLIT_ENABLED && ("""
new = """          <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-2 items-center">
            {(isScheduled || isFailed) && (c.customer_profile_id ? (
              <button onClick={() => onAction({ type: 'charge_now', charge_id: c.id, amount: c.amount, cardLast4: c.card_last_4 })}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-green-600 rounded hover:bg-green-700">
                <Zap size={12} /> Charge Now
              </button>
            ) : (
              <button onClick={() => onAction({ type: 'add_card', deal_id, client_name, client_email })}
                title="No card on file yet. Add a card before charging."
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-asap-blue bg-white border border-asap-blue rounded hover:bg-blue-50">
                <DollarSign size={12} /> Add card to charge
              </button>
            ))}
            {SPLIT_ENABLED && ("""
if s.count(old) != 1: print(f"ABORTED: non-admin block anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("CHARGE NOW ADDED to consultant/AM card actions (with add-card fallback)")
