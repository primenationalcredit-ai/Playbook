import sys

def load(p): return open(p, 'rb').read().decode('utf-8', errors='surrogateescape')
def save(p, s): open(p, 'wb').write(s.encode('utf-8', errors='surrogateescape'))

# 1) METRICS: PIF loop reads the cross-month map; bonus lands in the FINAL's month
f = 'netlify/functions/consultant-bonus-metrics.js'
s = load(f)
old = """      for (const client of clients) {
        if (!client.hasDocFee || !client.hasFinal || client.hasPartial) continue;"""
new = """      // PIF pairs cross month boundaries (doc fee July, final August) - use the
      // window map, not the month-scoped list, and credit the month the FINAL landed.
      for (const client of Object.values(windowClientMap)) {
        if (!client.hasDocFee || !client.hasFinal || client.hasPartial) continue;
        const pifFinal0 = client.payments.find(p => p.payment_type === 'final' || p.payment_type === 'paid_in_full');
        const pifFinalMonth = pifFinal0 ? String(pifFinal0.payment_month || String(pifFinal0.payment_date).slice(0, 7)) : null;
        if (pifFinalMonth !== targetMonth) continue;"""
if s.count(old) != 1: print(f"ABORTED: metrics PIF anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
save(f, s)
print("metrics: PIF now pairs across months, credited to the final's month")

# 2) SYNC: don't count the signup day
f = 'netlify/functions/consultant-bonus-sync.js'
s = load(f)
old = """          const addDate = new Date(deal.add_time);
          let bizDays = 0, d = new Date(addDate);
          while (d <= now && bizDays <= 6) {"""
new = """          const addDate = new Date(deal.add_time);
          let bizDays = 0, d = new Date(addDate);
          d.setDate(d.getDate() + 1); // day AFTER signup is business day 1 (matches the $25 math)
          while (d <= now && bizDays <= 6) {"""
if s.count(old) != 1: print(f"ABORTED: sync anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
save(f, s)
print("sync: fencepost fixed")

# 3) HOOK + WATCHDOGS: same fencepost in the shared-shape bizDaysSince
old = "  let biz = 0, d = new Date(addTime); d.setHours(0, 0, 0, 0);"
new = "  let biz = 0, d = new Date(addTime); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 1); // day AFTER signup is day 1"
for fn in ['final-credit-hook.js', 'qualified-doc-watchdog.js', 'watchdog-manual.js']:
    p = 'netlify/functions/' + fn
    s = load(p)
    n = s.count(old)
    if n == 1:
        save(p, s.replace(old, new, 1)); print(f"{fn}: fencepost fixed")
    elif n == 0:
        print(f"{fn}: no local bizDaysSince (shares another file's) - nothing to patch")
    else:
        print(f"ABORTED: {fn} anchor x{n}"); sys.exit(1)
print("all writers aligned")
