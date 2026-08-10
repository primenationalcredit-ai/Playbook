# affiliate-book-sync: never credit a payment that predates the affiliate's org.
# Lead-import retro-tagging labeled years-old client payments with new affiliates'
# names (Paul Ashton: created 3/30/2026, credited with 2021-2023 sales -> "8 sold"
# when the truth is 1). Keep per-payment dates and filter per org by add_time.
import sys
f = 'netlify/functions/affiliate-book-sync.js'
s = open(f, encoding='utf-8').read()
fails = []

oldA = """          if (!soldByOrg[key]) soldByOrg[key] = { clients: new Set(), lastDate: null };
          soldByOrg[key].clients.add(String(p.pipedrive_deal_id || p.client_name));
          const dt = String(p.payment_date || '').slice(0, 10);
          if (dt && (!soldByOrg[key].lastDate || dt > soldByOrg[key].lastDate)) soldByOrg[key].lastDate = dt;"""
newA = """          if (!soldByOrg[key]) soldByOrg[key] = { items: [] };
          const dt = String(p.payment_date || '').slice(0, 10);
          soldByOrg[key].items.push({ c: String(p.pipedrive_deal_id || p.client_name), d: dt || null });"""
if s.count(oldA) != 1: fails.append(f"accumulator anchor x{s.count(oldA)}")
else: s = s.replace(oldA, newA, 1); print("OK 1: payments keep their dates")

oldB = """      const sold = soldByOrg[norm(o.name)] || null;
      const soldCount = sold ? sold.clients.size : 0;
      const lastRef = sold ? sold.lastDate : null;"""
newB = """      // Date guard: a payment can only be this affiliate's sale if it happened
      // after the affiliate existed. Kills retro-attribution from lead imports.
      const orgBorn = o.add_time ? String(o.add_time).slice(0, 10) : null;
      const soldAll = soldByOrg[norm(o.name)] || null;
      const soldItems = soldAll ? soldAll.items.filter((x) => !orgBorn || !x.d || x.d >= orgBorn) : [];
      const soldCount = new Set(soldItems.map((x) => x.c)).size;
      const lastRef = soldItems.reduce((m, x) => (x.d && (!m || x.d > m) ? x.d : m), null);"""
if s.count(oldB) != 1: fails.append(f"stats anchor x{s.count(oldB)}")
else: s = s.replace(oldB, newB, 1); print("OK 2: sales credited only after the org existed")

if fails:
    print("ABORTED:"); [print(" -", x) for x in fails]; sys.exit(1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("DATE GUARD IN")
