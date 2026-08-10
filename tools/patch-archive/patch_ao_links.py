import sys
f = 'src/pages/AffiliateOutreach.jsx'
s = open(f, encoding='utf-8').read()

old = """                      <div className="font-semibold flex items-center gap-2">
                        <PhoneCall className="w-4 h-4 text-blue-600" /> {t.org_name}
                        <span className={`text-xs px-2 py-0.5 rounded-full ${segMeta(t.segment).color}`}>{segMeta(t.segment).label}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {t.contact_phone || 'no phone'} \u00b7 {t.stats_line} \u00b7 assigned to {t.assigned_to || 'anyone'} \u00b7 due {t.due_date}
                      </div>"""
new = """                      <div className="font-semibold flex items-center gap-2">
                        <PhoneCall className="w-4 h-4 text-blue-600" />
                        {t.pipedrive_org_id ? (
                          <a href={`https://asapcreditrepair.pipedrive.com/organization/${t.pipedrive_org_id}`} target="_blank" rel="noopener noreferrer"
                            className="hover:underline text-blue-700" title="Open in Pipedrive">{t.org_name}</a>
                        ) : t.org_name}
                        <span className={`text-xs px-2 py-0.5 rounded-full ${segMeta(t.segment).color}`}>{segMeta(t.segment).label}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {t.contact_phone ? (
                          <a href={`tel:${String(t.contact_phone).replace(/[^0-9+]/g, '')}`} className="text-blue-600 hover:underline">{t.contact_phone}</a>
                        ) : 'no phone'} \u00b7 {t.stats_line} \u00b7 assigned to {t.assigned_to || 'anyone'} \u00b7 due {t.due_date}
                      </div>"""
if s.count(old) != 1: print(f"ABORTED: card anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("QUEUE CARDS: org name links to Pipedrive org, phone is a tel: click-to-dial link")
