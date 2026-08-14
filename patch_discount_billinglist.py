import sys
f = 'src/pages/Invoices.jsx'
s = open(f, encoding='utf-8', errors='surrogateescape').read()

# ---- 1) button, right after fixAddress's button ----
a1 = """        <button onClick={fixAddress} disabled={fixing || charging}
          title="Correct the billing address on file without touching the card itself"
          className="text-[11px] font-semibold px-2 py-1 rounded-lg border border-asap-blue text-asap-blue hover:bg-blue-50 disabled:opacity-50 whitespace-nowrap">
          {fixing ? 'Saving...' : 'Fix Address'}
        </button>"""
if s.count(a1) != 1: print("ABORTED: fixAddress button anchor x" + str(s.count(a1))); sys.exit(1)
btn = a1 + """
        {isAdmin && (
          <button onClick={applyDiscount} disabled={discounting}
            title="Apply a leadership discount to this invoice"
            className="text-[11px] font-semibold px-2 py-1 rounded-lg border border-amber-400 text-amber-700 hover:bg-amber-50 disabled:opacity-50 whitespace-nowrap">
            {discounting ? 'Applying...' : 'Discount'}
          </button>
        )}"""
s = s.replace(a1, btn, 1)
print("BillingList: Discount button added")

# ---- 2) applyDiscount function, right after fixAddress's function ----
a2 = """  const badge = attempts === 0"""
if s.count(a2) != 1: print("ABORTED: insert-point anchor x" + str(s.count(a2))); sys.exit(1)
fn = """  const [discounting, setDiscounting] = useState(false);
  const applyDiscount = async () => {
    if (discounting) return;
    const pctStr = window.prompt(`Discount percentage off $${Number(r.amount).toFixed(2)} for ${r.client_name || 'this client'}:`, '10');
    if (pctStr === null) return;
    const pct = parseFloat(pctStr);
    if (!(pct > 0) || pct >= 100) { alert('Enter a percentage between 0 and 100.'); return; }
    const reason = window.prompt('Reason (optional):') || '';
    if (!window.confirm(`Apply a ${pct}% discount? This will reduce what's owed (or refund the difference if already paid).`)) return;
    setDiscounting(true);
    try {
      const res = await callApi('apply_discount', { charge_id: r.id, percent: pct, reason });
      alert(`Discount applied. New amount: $${Number(res.new_amount).toFixed(2)}` + (res.was_paid ? ' (refunded the difference).' : ' (invoice reduced, nothing charged yet).'));
    } catch (e) {
      alert('Could not apply discount: ' + (e.message || e));
    }
    setDiscounting(false);
  };
  const badge = attempts === 0"""
s = s.replace(a2, fn, 1)
print("BillingList: applyDiscount function added")

# ---- 3) BillingList needs isAdmin passed in - check its own signature and the <BillingList> call sites ----
sig_old = "function BillingList({ title, icon, rows, emptyText, showDecline = false, defaultOpen = false }) {"
if s.count(sig_old) != 1: print("ABORTED: BillingList signature anchor x" + str(s.count(sig_old))); sys.exit(1)
s = s.replace(sig_old, "function BillingList({ title, icon, rows, emptyText, showDecline = false, defaultOpen = false, isAdmin = false }) {", 1)
print("BillingList signature accepts isAdmin")

open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
