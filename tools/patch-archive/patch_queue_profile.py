# Call queue: full affiliate profile panel (org details + LIVE Pipedrive
# Additional F/U Notes + referred clients) on every task card.
import sys
f = 'netlify/functions/affiliate-referred-deals.js'
s = open(f, encoding='utf-8').read()
fails = []

oldA = "&select=id,org_name,pipedrive_org_id,contact_name,contact_email,contact_phone,portal_link,pipedrive_add_time,org_created_at`"
newA = "&select=id,org_name,pipedrive_org_id,contact_name,contact_email,contact_phone,portal_link,pipedrive_add_time,org_created_at,company,occupation,industry,owner_name,segment,referred_deals,sold_clients,last_referral_date,pipedrive_fu_notes`"
if s.count(oldA) != 1: fails.append(f"select anchor x{s.count(oldA)}")
else: s = s.replace(oldA, newA, 1); print("OK 1: profile fields in select")

oldB = "    if (!aff || !aff.pipedrive_org_id) return { statusCode: 404, headers, body: JSON.stringify({ error: 'affiliate not found or no pipedrive org' }) };"
newB = oldB + """

    // Previous call notes: LIVE from the Pipedrive org's Additional F/U Notes
    // (falls back to the synced copy if Pipedrive is unreachable)
    const PD_FU_NOTES_KEY = '17c6fcd0a8bcc21bbba680a8fe82697d9f996df9';
    let fuNotes = aff.pipedrive_fu_notes || null;
    try {
      const og = await fetch(`https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/organizations/${aff.pipedrive_org_id}?api_token=${PIPEDRIVE_TOKEN}`);
      const od = await og.json();
      const live = od && od.data && od.data[PD_FU_NOTES_KEY];
      if (live) fuNotes = String(live);
    } catch (e) {}"""
if s.count(oldB) != 1: fails.append(f"404 anchor x{s.count(oldB)}")
else: s = s.replace(oldB, newB, 1); print("OK 2: live F/U notes fetch")

oldC = "    return { statusCode: 200, headers, body: JSON.stringify({ org: aff.org_name, pipedrive_org_id: aff.pipedrive_org_id, contact: { name: aff.contact_name || null, email: aff.contact_email || null, phone: aff.contact_phone || null, portal_link: aff.portal_link || null }, stats, deals: list }) };"
newC = "    return { statusCode: 200, headers, body: JSON.stringify({ org: aff.org_name, pipedrive_org_id: aff.pipedrive_org_id, contact: { name: aff.contact_name || null, email: aff.contact_email || null, phone: aff.contact_phone || null, portal_link: aff.portal_link || null }, profile: { company: aff.company || null, occupation: aff.occupation || null, industry: aff.industry || null, owner: aff.owner_name || null, segment: aff.segment || null }, fu_notes: fuNotes, stats, deals: list }) };"
if s.count(oldC) != 1: fails.append(f"return anchor x{s.count(oldC)}")
else: s = s.replace(oldC, newC, 1); print("OK 3: profile + notes in payload")

if fails:
    print("ABORTED (function):"); [print(" -", x) for x in fails]; sys.exit(1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("FUNCTION DONE")

# ---------------- UI ----------------
f2 = 'src/pages/AffiliateOutreach.jsx'
s2 = open(f2, encoding='utf-8').read()

component = """
const AffiliateProfileModal = ({ data, onClose, fallbackName }) => (
  <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col text-left" onClick={(e) => e.stopPropagation()}>
      <div className="px-5 py-4 border-b flex items-start justify-between">
        <div>
          <div className="font-bold text-lg">{(data && data.org) || fallbackName}</div>
          {data && data.contact && (
            <div className="text-xs text-gray-600 mt-0.5">{data.contact.name || ''}{data.contact.email ? ` \u00b7 ${data.contact.email}` : ''}{data.contact.phone ? ` \u00b7 ${data.contact.phone}` : ''}</div>
          )}
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">{'\u00d7'}</button>
      </div>
      <div className="p-5 overflow-y-auto space-y-4">
        {!data && <div className="text-sm text-gray-500">Loading profile{'\u2026'}</div>}
        {data && data.error && <div className="text-sm text-red-600">{data.error}</div>}
        {data && data.profile && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div><div className="text-gray-400 text-xs">Company</div><div>{data.profile.company || '\u2014'}</div></div>
            <div><div className="text-gray-400 text-xs">Occupation</div><div>{data.profile.occupation || '\u2014'}</div></div>
            <div><div className="text-gray-400 text-xs">Industry</div><div>{data.profile.industry || '\u2014'}</div></div>
            <div><div className="text-gray-400 text-xs">Relationship owner</div><div>{data.profile.owner || '\u2014'}</div></div>
          </div>
        )}
        {data && data.stats && (
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="px-2 py-1 rounded-lg bg-gray-100">Referred: <b>{data.stats.total_referred}</b></span>
            <span className="px-2 py-1 rounded-lg bg-green-100 text-green-800">Sold: <b>{data.stats.total_sold}</b></span>
            <span className="px-2 py-1 rounded-lg bg-blue-100 text-blue-800">Open: <b>{data.stats.open_now}</b></span>
            {data.stats.last_referral && <span className="px-2 py-1 rounded-lg bg-gray-100">Last referral: <b>{data.stats.last_referral}</b></span>}
            {data.stats.last_sale && <span className="px-2 py-1 rounded-lg bg-gray-100">Last sale: <b>{data.stats.last_sale}</b></span>}
          </div>
        )}
        {data && (
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Previous call notes (Additional F/U Notes, live from Pipedrive)</div>
            {data.fu_notes
              ? <pre className="text-xs bg-amber-50 border border-amber-100 rounded-lg p-3 whitespace-pre-wrap font-sans text-gray-700 max-h-48 overflow-y-auto">{data.fu_notes}</pre>
              : <div className="text-xs text-gray-400">No previous notes on record.</div>}
          </div>
        )}
        {data && Array.isArray(data.deals) && (
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Referred clients</div>
            {data.deals.length === 0 && <div className="text-xs text-gray-400">No referred deals found.</div>}
            <div className="divide-y">
              {data.deals.map((d) => (
                <div key={d.deal_id} className="py-2 flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{d.client}</div>
                    <div className="text-xs text-gray-400">added {d.added || '?'}{d.won ? ` \u00b7 sold ${d.won}` : ''}{d.lost ? ` \u00b7 lost ${d.lost}` : ''}</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${d.sold ? 'bg-green-100 text-green-700' : d.status === 'lost' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-700'}`}>{d.sold ? 'SOLD' : d.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
);
"""

oldD = "const sbPost = async (q, body) => fetch(`${SUPABASE_URL}/rest/v1/${q}`, { method: 'POST', headers: { ...sbHeaders, Prefer: 'return=minimal' }, body: JSON.stringify(body) });"
if s2.count(oldD) != 1:
    print(f"ABORTED (ui): sbPost anchor x{s2.count(oldD)}"); sys.exit(1)
s2 = s2.replace(oldD, oldD + "\n" + component, 1)
print("OK 4: profile modal component")

oldE = """                      <div className="text-xs text-gray-500 mt-1">
                        {t.contact_phone || 'no phone'} \u00b7 {t.stats_line} \u00b7 assigned to {t.assigned_to || 'anyone'} \u00b7 due {t.due_date}
                      </div>"""
newE = oldE + """
                      <button onClick={() => openReferred({ id: t.affiliate_org_id })} className="mt-1 text-xs text-blue-600 hover:underline font-medium">View affiliate profile {'\u2192'}</button>
                      {refOpen === t.affiliate_org_id && <AffiliateProfileModal data={refData[t.affiliate_org_id]} onClose={() => setRefOpen(null)} fallbackName={t.org_name} />}"""
if s2.count(oldE) != 1:
    print(f"ABORTED (ui): queue card anchor x{s2.count(oldE)}")
    for i, ln in enumerate(s2.split('\n'), 1):
        if 'stats_line' in ln: print(f"  cand {i}: {repr(ln[:150])}")
    sys.exit(1)
s2 = s2.replace(oldE, newE, 1)
print("OK 5: profile link + modal on queue cards")

open(f2, 'w', encoding='utf-8', newline='').write(s2)
print("QUEUE PROFILE SHIPPED")
