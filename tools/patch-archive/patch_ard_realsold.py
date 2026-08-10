# affiliate-referred-deals: per-client SOLD from consultant_payments (the same
# source the corrected book uses), date-guarded like the book-sync fix, plus
# affiliate contact info in the payload + modal header.
import sys
f = 'netlify/functions/affiliate-referred-deals.js'
s = open(f, encoding='utf-8').read()
fails = []

oldA = "&select=id,org_name,pipedrive_org_id`"
newA = "&select=id,org_name,pipedrive_org_id,contact_name,contact_email,contact_phone,portal_link,pipedrive_add_time,org_created_at`"
if s.count(oldA) != 1: fails.append(f"select anchor x{s.count(oldA)}")
else: s = s.replace(oldA, newA, 1); print("OK 1: pull contact + org birth date")

oldB = "    const CS_KEY = '612856f2221d04679c1809eadb77b30300936445'; // CURRENT STATUS field; 1901 = SOLD"
newB = """    const CS_KEY = '612856f2221d04679c1809eadb77b30300936445'; // CURRENT STATUS field; 1901 = SOLD
    // Sales truth lives in payment records, not on referral deals. Match by deal
    // id or client name, date-guarded: a payment only counts if it happened after
    // the affiliate existed (same rule as the book-sync).
    const normName = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const soldDealIds = new Set();
    const soldNames = new Set();
    try {
      const born = String(aff.pipedrive_add_time || aff.org_created_at || '').slice(0, 10) || null;
      const pRes = await fetch(`${SUPABASE_URL}/rest/v1/consultant_payments?referrer_org=ilike.${encodeURIComponent(aff.org_name)}&select=pipedrive_deal_id,client_name,payment_date`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      });
      const pays = pRes.ok ? await pRes.json() : [];
      for (const p of (Array.isArray(pays) ? pays : [])) {
        const d = String(p.payment_date || '').slice(0, 10);
        if (born && d && d < born) continue;
        if (p.pipedrive_deal_id) soldDealIds.add(String(p.pipedrive_deal_id));
        if (p.client_name) soldNames.add(normName(p.client_name));
      }
    } catch (e) {}"""
if s.count(oldB) != 1: fails.append(f"CS_KEY anchor x{s.count(oldB)}")
else: s = s.replace(oldB, newB, 1); print("OK 2: date-guarded payment matching")

oldC = "      sold: d.status === 'won' || String(d[CS_KEY] ?? '') === '1901',"
newC = "      sold: d.status === 'won' || String(d[CS_KEY] ?? '') === '1901' || soldDealIds.has(String(d.id)) || soldNames.has(normName((d.person_id && d.person_id.name) || d.person_name || '')),"
if s.count(oldC) != 1: fails.append(f"sold flag anchor x{s.count(oldC)}")
else: s = s.replace(oldC, newC, 1); print("OK 3: per-client sold flag")

oldD = "    return { statusCode: 200, headers, body: JSON.stringify({ org: aff.org_name, pipedrive_org_id: aff.pipedrive_org_id, stats, deals: list }) };"
newD = "    return { statusCode: 200, headers, body: JSON.stringify({ org: aff.org_name, pipedrive_org_id: aff.pipedrive_org_id, contact: { name: aff.contact_name || null, email: aff.contact_email || null, phone: aff.contact_phone || null, portal_link: aff.portal_link || null }, stats, deals: list }) };"
if s.count(oldD) != 1: fails.append(f"return anchor x{s.count(oldD)}")
else: s = s.replace(oldD, newD, 1); print("OK 4: contact in payload")

if fails:
    print("ABORTED (function):"); [print(" -", x) for x in fails]; sys.exit(1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("FUNCTION DONE")

# --- modal header: contact line under the title ---
f2 = 'src/pages/AffiliateOutreach.jsx'
s2 = open(f2, encoding='utf-8').read()
oldE = "<div className=\"text-xs text-gray-500\">Referred clients {'\\u00b7'} pulled live from Pipedrive</div>"
newE = oldE + """
                                    {refData[a.id] && refData[a.id].contact && (refData[a.id].contact.name || refData[a.id].contact.email || refData[a.id].contact.phone) && (
                                      <div className="text-xs text-gray-600 mt-1">{refData[a.id].contact.name || ''}{refData[a.id].contact.email ? ` \\u00b7 ${refData[a.id].contact.email}` : ''}{refData[a.id].contact.phone ? ` \\u00b7 ${refData[a.id].contact.phone}` : ''}</div>
                                    )}"""
if s2.count(oldE) != 1:
    print(f"ABORTED (modal): header anchor x{s2.count(oldE)}")
    for i, ln in enumerate(s2.split('\n'), 1):
        if 'pulled live' in ln: print(f"  cand {i}: {repr(ln.strip()[:140])}")
    sys.exit(1)
s2 = s2.replace(oldE, newE, 1)
open(f2, 'w', encoding='utf-8', newline='').write(s2)
print("MODAL DONE: contact line in header")
