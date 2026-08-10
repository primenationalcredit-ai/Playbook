import sys
f = 'src/pages/Invoices.jsx'
s = open(f, encoding='utf-8').read()

old = "  const [chargeTries, setChargeTries] = useState(r.retry_count || 0);"
new = "  const [chargeTries, setChargeTries] = useState(r.charge_attempts != null ? r.charge_attempts : (r.retry_count || 0));"
if s.count(old) != 1: print(f"ABORTED: seed anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)

old = """  return (
    <div className="flex items-center justify-between gap-2 mt-1 px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-100">"""
new = """  return (<>
    <div className="flex items-center justify-between gap-2 mt-1 px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-100">"""
if s.count(old) != 1: print(f"ABORTED: open anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)

old = """        </button>
      </div>
    </div>
  );
}"""
new = """        </button>
      </div>
    </div>
    {Array.isArray(r.charge_log) && r.charge_log.length > 0 && (
      <details className="mt-1 px-2">
        <summary className="text-[11px] text-slate-500 cursor-pointer select-none">charge history ({r.charge_log.length})</summary>
        <ul className="mt-1 space-y-0.5">
          {r.charge_log.slice().reverse().map((h, i) => (
            <li key={i} className={`text-[11px] ${h.result === 'collected' ? 'text-green-700' : 'text-red-600'}`}>
              {new Date(h.at).toLocaleString()} - {h.result === 'collected' ? `collected $${Number(h.amount).toFixed(2)}` : `declined${h.reason ? ': ' + h.reason : ''}`} - {(h.by || '').split('@')[0]}
            </li>
          ))}
        </ul>
      </details>
    )}
  </>);
}"""
if s.count(old) != 1: print(f"ABORTED: close anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("cards show full charge history: date+time, outcome, who - counter reads the permanent log")
