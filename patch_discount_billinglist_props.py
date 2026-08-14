import sys
f = 'src/pages/Invoices.jsx'
s = open(f, encoding='utf-8', errors='surrogateescape').read()

sites = [
    '<BillingList title="Due Today" icon={<AlarmClock size={15} className="text-amber-600" />} rows={data.due_today || []} emptyText="Nothing bills today." defaultOpen={true} />',
    '<BillingList title={range === \'all\' ? \'Upcoming (all scheduled)\' : `Upcoming (${range} days)`} icon={<CalendarClock size={15} className="text-sky-600" />} rows={(() => { const all = data.upcoming_all || data.upcoming_7_days || []; if (range === \'all\') return all; const lim = new Date(Date.now() + range * 86400000).toISOString().slice(0, 10); return all.filter(r => (r.due_date || \'\') <= lim); })()} emptyText="Nothing scheduled in this window." />',
    '<BillingList title="Declined — needs outreach" icon={<XCircle size={15} className="text-red-600" />} rows={data.declined_open || []} emptyText="No open declines. 🎉" showDecline={true} defaultOpen={true} />',
]
found = 0
for site in sites:
    c = s.count(site)
    if c == 1:
        new_site = site[:-3] + ' isAdmin={isAdmin} />'
        s = s.replace(site, new_site, 1)
        found += 1
    elif c == 0:
        print("MISS (0 matches, whitespace/encoding likely differs): " + site[:80])
    else:
        print("ABORTED: a site matched " + str(c) + " times: " + site[:80]); sys.exit(1)

print("patched " + str(found) + " of 3 call sites")
if found == 3:
    open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
    print("file written")
else:
    print("NOT WRITTEN - fewer than 3 matched, need to see exact bytes")
    sys.exit(1)
