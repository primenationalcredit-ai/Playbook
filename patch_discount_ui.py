import sys
f = 'src/pages/Invoices.jsx'
s = open(f, encoding='utf-8', errors='surrogateescape').read()

# ---- 1) & 2) the two Fix Address buttons in the ternary-fragment locations ----
targets = [
    ("""<button onClick={() => onAction({ type: 'fix_address', deal_id, client_name })}
                  title="Correct the billing address on file without touching the card itself"
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-asap-blue bg-white border border-asap-blue rounded hover:bg-blue-50">
                  <FileText size={12} /> Fix Address
                </button>""",
     """<button onClick={() => onAction({ type: 'fix_address', deal_id, client_name })}
                  title="Correct the billing address on file without touching the card itself"
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-asap-blue bg-white border border-asap-blue rounded hover:bg-blue-50">
                  <FileText size={12} /> Fix Address
                </button>
                <button onClick={() => onAction({ type: 'discount', charge_id: c.id, amount: c.amount, deal_id })}
                  title="Apply a leadership discount to this invoice"
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-amber-700 bg-white border border-amber-400 rounded hover:bg-amber-50">
                  <DollarSign size={12} /> Discount
                </button>"""),
    ("""<button onClick={() => onAction({ type: 'fix_address', deal_id, client_name })}
                title="Correct the billing address on file without touching the card itself"
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-asap-blue bg-white border border-asap-blue rounded hover:bg-blue-50">
                <FileText size={12} /> Fix Address
              </button>""",
     """<button onClick={() => onAction({ type: 'fix_address', deal_id, client_name })}
                title="Correct the billing address on file without touching the card itself"
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-asap-blue bg-white border border-asap-blue rounded hover:bg-blue-50">
                <FileText size={12} /> Fix Address
              </button>
              <button onClick={() => onAction({ type: 'discount', charge_id: c.id, amount: c.amount, deal_id })}
                title="Apply a leadership discount to this invoice"
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-amber-700 bg-white border border-amber-400 rounded hover:bg-amber-50">
                <DollarSign size={12} /> Discount
              </button>"""),
]
found = 0
for old, new in targets:
    c = s.count(old)
    if c == 1:
        s = s.replace(old, new, 1); found += 1
    elif c > 1:
        print("ABORTED: a target matched " + str(c) + " times - ambiguous"); sys.exit(1)
if found != 2:
    print("ABORTED: expected 2 Fix Address buttons, found and patched " + str(found)); sys.exit(1)
print("2 deal-lookup Discount buttons added")

# ---- 3) submit-branch dispatch, right after fix_address ----
a3 = """      } else if (modal.type === 'fix_address') {
        if (!form.zip && !form.address) throw new Error('Enter at least a street address or zip');
        await callApi('update_billing_address', { deal_id: modal.deal_id, billingAddress: { address: form.address, city: form.city, state: form.state, zip: form.zip }, cardholderName: modal.client_name });
        setNotice({ type: 'success', text: 'Billing address updated. The card itself was not changed - the next scheduled retry will use the corrected address.' });
"""
if s.count(a3) != 1: print("ABORTED: submit-branch anchor x" + str(s.count(a3))); sys.exit(1)
branch = a3 + """      } else if (modal.type === 'discount') {
        const pct = parseFloat(form.percent);
        if (!(pct > 0) || pct >= 100) throw new Error('Enter a percentage between 0 and 100');
        const r = await callApi('apply_discount', { charge_id: modal.charge_id, percent: pct, reason: form.reason });
        setNotice({ type: 'success', text: `${pct}% discount applied. New amount: $${Number(r.new_amount).toFixed(2)}` + (r.was_paid ? ' (refunded the difference)' : ' (invoice reduced, nothing charged yet)') });
"""
s = s.replace(a3, branch, 1)
print("submit branch for discount added")

# ---- 4) modal body fields, right after the fix_address fields ----
a4 = """            {modal.type === 'fix_address' && (
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
"""
if s.count(a4) != 1: print("ABORTED: fix_address fields anchor x" + str(s.count(a4))); sys.exit(1)
fields = a4 + """            {modal.type === 'discount' && (
              <div className="mb-4 space-y-2">
                <p className="text-xs text-slate-500 -mt-2 mb-2">Leadership only. Works on unpaid invoices (reduces what's owed) and paid invoices (refunds the difference).</p>
                <div className="flex items-center gap-2">
                  <input type="number" min="1" max="99" placeholder="10" defaultValue={10} value={form.percent ?? 10} onChange={e => setForm({ ...form, percent: e.target.value })}
                    className="w-20 px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-asap-blue" />
                  <span className="text-sm text-slate-600">% off {modal.amount ? '$' + Number(modal.amount).toFixed(2) : 'this invoice'}</span>
                </div>
                <input placeholder="Reason (optional)" value={form.reason || ''} onChange={e => setForm({ ...form, reason: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:border-asap-blue" />
              </div>
            )}
"""
s = s.replace(a4, fields, 1)
print("discount modal fields added")

open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
