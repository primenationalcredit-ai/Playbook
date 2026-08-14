import sys
# ---- 1) invoices-api.js: allow the new action through the proxy ----
f1 = 'netlify/functions/invoices-api.js'
s1 = open(f1, encoding='utf-8', errors='surrogateescape').read()
a1 = "'update_card_on_file', 'collect_and_save_card',"
if s1.count(a1) != 1: print("ABORTED: allowlist anchor x" + str(s1.count(a1))); sys.exit(1)
s1 = s1.replace(a1, "'update_card_on_file', 'collect_and_save_card', 'update_billing_address',", 1)
open(f1, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s1)
print("invoices-api.js: allowlist updated")

# ---- 2) Invoices.jsx: Fix Address button + modal ----
f2 = 'src/pages/Invoices.jsx'
s2 = open(f2, encoding='utf-8', errors='surrogateescape').read()

# button - only when a card is already on file (c.customer_profile_id truthy branch)
a2 = """                <button onClick={() => onAction({ type: 'charge_now', charge_id: c.id, amount: c.amount, cardLast4: c.card_last_4 })}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-green-600 rounded hover:bg-green-700">
                  <Zap size={12} /> Charge Now
                </button>"""
if s2.count(a2) != 1: print("ABORTED: charge_now button anchor x" + str(s2.count(a2))); sys.exit(1)
btn = a2 + """
                <button onClick={() => onAction({ type: 'fix_address', deal_id, client_name })}
                  title="Correct the billing address on file without touching the card itself"
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-asap-blue bg-white border border-asap-blue rounded hover:bg-blue-50">
                  <FileText size={12} /> Fix Address
                </button>"""
s2 = s2.replace(a2, btn, 1)

# modal - fields, wired into the generic modal body right after the due-date block
a3 = """            {(modal.type === 'update_due_date' || modal.type === 'request_date_change') && (
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-500 mb-1">New due date</label>
                <input type="date" value={form.new_due_date || ''} onChange={e => setForm({ ...form, new_due_date: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-asap-blue" />"""
if s2.count(a3) != 1: print("ABORTED: modal-body anchor x" + str(s2.count(a3))); sys.exit(1)
fields = """            {modal.type === 'fix_address' && (
              <div className="mb-4 space-y-2">
                <p className="text-xs text-slate-500 -mt-2 mb-2">Corrects the billing address the card issuer checks (AVS). The card number and expiration are never touched.</p>
                <input placeholder="Street address" value={form.address || ''} onChange={e => setForm({ ...form, address: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-asap-blue" />
                <div className="flex gap-2">
                  <input placeholder="City" value={form.city || ''} onChange={e => setForm({ ...form, city: e.target.value })}
                    className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-asap-blue" />
                  <input placeholder="State" maxLength={2} value={form.state || ''} onChange={e => setForm({ ...form, state: e.target.value.toUpperCase() })}
                    className="w-16 px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-asap-blue" />
                  <input placeholder="Zip" value={form.zip || ''} onChange={e => setForm({ ...form, zip: e.target.value })}
                    className="w-24 px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-asap-blue" />
                </div>
              </div>
            )}
""" + a3
s2 = s2.replace(a3, fields, 1)

open(f2, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s2)
print("Invoices.jsx: button + modal fields added")
