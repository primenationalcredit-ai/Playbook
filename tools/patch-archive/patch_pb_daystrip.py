import sys

# ---- A. Invoices.jsx: Charge Now shows the REAL outcome ----
f = 'src/pages/Invoices.jsx'
s = open(f, encoding='utf-8').read()
old = """      } else if (modal.type === 'charge_now') {
        await callApi('charge_now', { charge_id: modal.charge_id });
        setNotice({ type: 'success', text: 'Charge submitted.' });"""
new = """      } else if (modal.type === 'charge_now') {
        const r = await callApi('charge_now', { charge_id: modal.charge_id });
        const txn = r.transaction_id || r.transactionId || (r.charge && r.charge.transaction_id) || null;
        const amt = modal.amount ? ' $' + Number(modal.amount).toFixed(2) : '';
        setNotice({ type: 'success', text: 'Payment collected' + amt + (txn ? ' - txn ' + txn : '') + '. Refresh the page to see it move to Paid.' });"""
if s.count(old) != 1: print(f"ABORTED: charge_now anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("A done: charge_now reports collected amount + txn (declines already surface via the error path)")

# ---- B. AllPayments.jsx: Yesterday's sales strip + one-click day filter ----
f = 'src/pages/AllPayments.jsx'
s = open(f, encoding='utf-8').read()
old = "  const [msg, setMsg] = useState(null);"
new = """  const [msg, setMsg] = useState(null);
  // Yesterday's sales strip (Joe 7/31): total + count at the top, click to filter.
  const [yday, setYday] = useState(null);
  const [dayFilter, setDayFilter] = useState('');
  useEffect(() => {
    (async () => {
      try {
        const d = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        const res = await fetch(`/.netlify/functions/all-payments?month=${d.slice(0, 7)}`);
        const data = await res.json().catch(() => ({}));
        const rows = (Array.isArray(data.payments) ? data.payments : []).filter(p => String(p.payment_date || '').slice(0, 10) === d);
        setYday({ date: d, count: rows.length, total: rows.reduce((t, p) => t + (Number(p.amount) || 0), 0) });
      } catch (e) { /* strip just stays hidden */ }
    })();
  }, []);"""
if s.count(old) != 1: print(f"ABORTED: state anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)

old = "  const filtered = payments.filter(p => !search || (p.client_name || '').toLowerCase().includes(search.toLowerCase()) || String(p.pipedrive_deal_id || '').includes(search));"
new = "  const filtered = payments.filter(p => (!dayFilter || String(p.payment_date || '').slice(0, 10) === dayFilter) && (!search || (p.client_name || '').toLowerCase().includes(search.toLowerCase()) || String(p.pipedrive_deal_id || '').includes(search)));"
if s.count(old) != 1: print(f"ABORTED: filtered anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)

old = "      {msg && <div className={`mb-4 text-sm px-4 py-2 rounded-lg"
new = """      {yday && (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800 text-white">
          <DollarSign size={18} className="text-green-400" />
          <div className="text-sm">
            <span className="font-semibold">Yesterday ({fmtDate(yday.date)}):</span> {fmt(yday.total)} across {yday.count} payment{yday.count === 1 ? '' : 's'}
          </div>
          <button
            onClick={() => { if (dayFilter) { setDayFilter(''); } else { setMonth(yday.date.slice(0, 7)); setDayFilter(yday.date); } }}
            className="ml-auto text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20">
            {dayFilter ? 'Show all' : 'View payments'}
          </button>
        </div>
      )}
      {msg && <div className={`mb-4 text-sm px-4 py-2 rounded-lg"""
if s.count(old) != 1: print(f"ABORTED: strip anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("B done: yesterday strip + day filter wired into the list")
