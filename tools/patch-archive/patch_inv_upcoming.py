import sys
f = 'src/pages/Invoices.jsx'
s = open(f, encoding='utf-8').read()

old = "  const [window_, setWindow_] = useState('month');"
new = """  const [window_, setWindow_] = useState('month');
  const [range, setRange] = useState(7); // upcoming view: 7 / 14 / 30 / 'all'"""
if s.count(old) != 1: print(f"ABORTED: state anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)

old = """      <BillingList title="Upcoming (7 days)" icon={<CalendarClock size={15} className="text-sky-600" />} rows={data.upcoming_7_days || []} emptyText="Nothing scheduled in the next 7 days." />"""
new = """      {data.outstanding && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-slate-800">
              Outstanding autobill: {data.outstanding.count} charges {'\\u00b7'} ${Number(data.outstanding.total).toLocaleString()}
              <span className="ml-2 text-xs font-normal text-slate-500">({data.outstanding.scheduled} scheduled, {data.outstanding.failed} in retry)</span>
            </span>
            <span className="flex gap-1">
              {[7, 14, 30, 'all'].map(r => (
                <button key={r} onClick={() => setRange(r)} className={`px-2 py-1 rounded text-xs font-semibold ${range === r ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{r === 'all' ? 'All' : `${r}d`}</button>
              ))}
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {(data.outstanding.by_day || []).filter(d => { if (range === 'all') return true; const lim = new Date(Date.now() + range * 86400000).toISOString().slice(0, 10); return d.date <= lim; }).map(d => {
              const today = new Date().toISOString().slice(0, 10);
              const past = d.date < today;
              return (
                <div key={d.date} title={past ? 'Failed charges awaiting retry from this date' : `${d.count} charges scheduled`} className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-center ${past ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
                  <div className="text-[10px] text-slate-500">{past ? 'retry ' : ''}{d.date.slice(5)}</div>
                  <div className="text-sm font-bold text-slate-800">{d.count}</div>
                  <div className="text-[10px] text-slate-600">${Number(d.total).toLocaleString()}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <BillingList title={range === 'all' ? 'Upcoming (all scheduled)' : `Upcoming (${range} days)`} icon={<CalendarClock size={15} className="text-sky-600" />} rows={(() => { const all = data.upcoming_all || data.upcoming_7_days || []; if (range === 'all') return all; const lim = new Date(Date.now() + range * 86400000).toISOString().slice(0, 10); return all.filter(r => (r.due_date || '') <= lim); })()} emptyText="Nothing scheduled in this window." />"""
if s.count(old) != 1: print(f"ABORTED: widget anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("WIDGET UPGRADED: range selector + outstanding totals + per-day forecast strip")
