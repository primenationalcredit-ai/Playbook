import sys
f = 'src/pages/AllPayments.jsx'
s = open(f, encoding='utf-8').read()

old = """  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/.netlify/functions/all-payments?month=${month}`);
      const data = await res.json();
      setPayments(Array.isArray(data.payments) ? data.payments : []);
    } catch (e) { /* noop */ }
    setLoading(false);
  };"""
new = """  // Reconciliation vs the consultant breakdown (Astrid 8/4): the breakdown
  // nets out refunds executed this month; this listing shows gross payments.
  // Fetch the same refund lines the breakdown uses and show the math, so the
  // two screens visibly agree instead of silently differing.
  const [monthRefunds, setMonthRefunds] = useState(null);
  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/.netlify/functions/all-payments?month=${month}`);
      const data = await res.json();
      setPayments(Array.isArray(data.payments) ? data.payments : []);
    } catch (e) { /* noop */ }
    try {
      if (month !== 'all') {
        const r2 = await fetch(`/.netlify/functions/payments-live?months=${month}`);
        const d2 = await r2.json().catch(() => ({}));
        const rws = ((d2 && d2[month]) || {}).rows || [];
        const refs = rws.filter(x => x.code === 'refund');
        setMonthRefunds(refs.length ? { count: refs.length, total: refs.reduce((t, x) => t + (Number(x.fee_paid) || 0), 0) } : null);
      } else setMonthRefunds(null);
    } catch (e) { setMonthRefunds(null); }
    setLoading(false);
  };"""
if s.count(old) != 1: print(f"ABORTED: load anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)

old = """  return (
    <div className={embedded ? '' : 'p-6 lg:p-8 max-w-7xl mx-auto'}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">"""
new = """  return (
    <div className={embedded ? '' : 'p-6 lg:p-8 max-w-7xl mx-auto'}>
      {monthRefunds && (
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm bg-rose-50 border border-rose-100 rounded-xl px-4 py-2.5">
          <span className="font-semibold text-slate-700">Refunds this month:</span>
          <span className="font-bold text-rose-600">{monthRefunds.count} {'\\u00b7'} -${Math.abs(monthRefunds.total).toFixed(2)}</span>
          <span className="text-slate-500">Listing total ${total.toFixed(2)} {'\\u2212'} refunds = net ${(total + monthRefunds.total).toFixed(2)} {'\\u2014'} this net is the number the consultant breakdown shows.</span>
        </div>
      )}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">"""
if s.count(old) != 1: print(f"ABORTED: render anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("All Payments reconciles with the breakdown: refund line + net shown on the page")
