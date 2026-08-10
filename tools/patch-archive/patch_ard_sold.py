# affiliate-referred-deals: ASAP marks sales via the CURRENT STATUS deal field
# (1901 = SOLD), not Pipedrive won-status. Count both as sold.
import sys
f = 'netlify/functions/affiliate-referred-deals.js'
s = open(f, encoding='utf-8').read()
fails = []

oldA = "    const list = deals.map((d) => ({\n      deal_id: d.id,"
newA = """    const CS_KEY = '612856f2221d04679c1809eadb77b30300936445'; // CURRENT STATUS field; 1901 = SOLD
    const list = deals.map((d) => ({
      deal_id: d.id,
      sold: d.status === 'won' || String(d[CS_KEY] ?? '') === '1901',"""
if s.count(oldA) != 1: fails.append(f"map anchor x{s.count(oldA)}")
else: s = s.replace(oldA, newA, 1); print("OK: sold flag reads CURRENT STATUS")

oldB = "    const sold = list.filter((x) => x.status === 'won');"
newB = "    const sold = list.filter((x) => x.sold);"
if s.count(oldB) != 1: fails.append(f"sold filter x{s.count(oldB)}")
else: s = s.replace(oldB, newB, 1); print("OK: stats count ASAP-sold")

oldC = "      last_sale: sold.length ? sold.map((x) => x.won).sort().reverse()[0] : null"
newC = "      last_sale: sold.length ? sold.map((x) => x.won || x.added).sort().reverse()[0] : null"
if s.count(oldC) != 1: fails.append(f"last_sale x{s.count(oldC)}")
else: s = s.replace(oldC, newC, 1); print("OK: last_sale falls back for CS-sold deals")

if fails:
    print("ABORTED:"); [print(" -", x) for x in fails]; sys.exit(1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("SOLD DEFINITION FIXED")

# --- and the modal badge: use the sold flag, not pd won-status ---
f2 = 'src/pages/AffiliateOutreach.jsx'
s2 = open(f2, encoding='utf-8').read()
oldD = "<span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${d.status === 'won' ? 'bg-green-100 text-green-700' : d.status === 'lost' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-700'}`}>{d.status === 'won' ? 'SOLD' : d.status}</span>"
newD = "<span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${d.sold ? 'bg-green-100 text-green-700' : d.status === 'lost' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-700'}`}>{d.sold ? 'SOLD' : d.status}</span>"
if s2.count(oldD) != 1:
    print(f"ABORTED: modal badge anchor x{s2.count(oldD)}"); sys.exit(1)
s2 = s2.replace(oldD, newD, 1)
open(f2, 'w', encoding='utf-8', newline='').write(s2)
print("OK: modal SOLD badge uses the flag")
