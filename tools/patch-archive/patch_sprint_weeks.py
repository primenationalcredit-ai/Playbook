import sys
f = 'netlify/functions/consultant-bonus-metrics.js'
s = open(f, encoding='utf-8', errors='surrogateescape').read()

old = """      if (wStart > mStart) { // partial first week
        const wEnd = new Date(wStart); wEnd.setDate(wEnd.getDate() - 1);
        const wEndStr = wEnd.toISOString().split('T')[0];
        const weekPays = myPayments.filter(p => p.payment_type === 'doc_fee' && p.payment_date >= monthStart && p.payment_date <= wEndStr);
        weeks.push({ week: 1, start: monthStart, end: wEndStr, docs: weekPays.length, clients: weekPays.map(p => ({ name: p.client_name, amount: p.amount, date: p.payment_date, dealId: p.pipedrive_deal_id })) });
      }
      let weekNum = weeks.length + 1;"""
new = """      // SHORT-FIRST-WEEK ABSORPTION (Joe 8/7): a month starting Saturday made a
      // stranded 2-day sprint (8/1-8/2), Sunday would make a 1-day one. Rule: if
      // the pre-Monday stub is 2 days or less, sprint 1 runs from the 1st through
      // the FOLLOWING Sunday (one long week), then normal Mon-Sun resumes. A 3-6
      // day stub (month starts Tue-Fri) still stands as its own first sprint.
      const stubDays = Math.round((wStart - mStart) / 86400000);
      if (stubDays > 0 && stubDays <= 2) {
        const wEnd = new Date(wStart); wEnd.setDate(wEnd.getDate() + 6); // following Sunday
        const wEndStr = wEnd.toISOString().split('T')[0];
        const weekPays = myPayments.filter(p => p.payment_type === 'doc_fee' && p.payment_date >= monthStart && p.payment_date <= wEndStr);
        weeks.push({ week: 1, start: monthStart, end: wEndStr, docs: weekPays.length, clients: weekPays.map(p => ({ name: p.client_name, amount: p.amount, date: p.payment_date, dealId: p.pipedrive_deal_id })) });
        wStart.setDate(wStart.getDate() + 7); // the absorbed week is done - resume at the next Monday
      } else if (wStart > mStart) { // 3-6 day partial first week stands on its own
        const wEnd = new Date(wStart); wEnd.setDate(wEnd.getDate() - 1);
        const wEndStr = wEnd.toISOString().split('T')[0];
        const weekPays = myPayments.filter(p => p.payment_type === 'doc_fee' && p.payment_date >= monthStart && p.payment_date <= wEndStr);
        weeks.push({ week: 1, start: monthStart, end: wEndStr, docs: weekPays.length, clients: weekPays.map(p => ({ name: p.client_name, amount: p.amount, date: p.payment_date, dealId: p.pipedrive_deal_id })) });
      }
      let weekNum = weeks.length + 1;"""
if s.count(old) != 1: print(f"ABORTED: sprint anchor x{s.count(old)}"); sys.exit(1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s.replace(old, new, 1))
print("sprint weeks: short first-week absorption in")
