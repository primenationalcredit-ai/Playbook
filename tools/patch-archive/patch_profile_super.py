# Profile panel: show which super affiliate recruited them (origin).
import sys
f = 'netlify/functions/affiliate-referred-deals.js'
s = open(f, encoding='utf-8').read()

oldA = ",segment,referred_deals,sold_clients,last_referral_date,pipedrive_fu_notes`"
newA = ",segment,referred_deals,sold_clients,last_referral_date,pipedrive_fu_notes,recruited_by_super,super_affiliate`"
if s.count(oldA) != 1: print(f"ABORTED: select x{s.count(oldA)}"); sys.exit(1)
s = s.replace(oldA, newA, 1); print("OK 1: pull recruiter")

oldB = "profile: { company: aff.company || null, occupation: aff.occupation || null, industry: aff.industry || null, owner: aff.owner_name || null, segment: aff.segment || null }"
newB = "profile: { company: aff.company || null, occupation: aff.occupation || null, industry: aff.industry || null, owner: aff.owner_name || null, segment: aff.segment || null, recruited_by_super: aff.recruited_by_super || null, is_super: !!aff.super_affiliate }"
if s.count(oldB) != 1: print(f"ABORTED: return x{s.count(oldB)}"); sys.exit(1)
s = s.replace(oldB, newB, 1); print("OK 2: recruiter in payload")
open(f, 'w', encoding='utf-8', newline='').write(s)

f2 = 'src/pages/AffiliateOutreach.jsx'
s2 = open(f2, encoding='utf-8').read()
oldC = "            <div><div className=\"text-gray-400 text-xs\">Relationship owner</div><div>{data.profile.owner || '\u2014'}</div></div>"
newC = oldC + """
            <div><div className="text-gray-400 text-xs">Came from (super affiliate)</div><div>{data.profile.is_super ? 'Is a super affiliate' : (data.profile.recruited_by_super || 'Direct / unknown')}</div></div>"""
if s2.count(oldC) != 1:
    print(f"ABORTED: modal x{s2.count(oldC)}")
    for i, ln in enumerate(s2.split('\n'), 1):
        if 'Relationship owner' in ln: print(f"  cand {i}: {repr(ln[:150])}")
    sys.exit(1)
s2 = s2.replace(oldC, newC, 1); print("OK 3: origin row in modal")
open(f2, 'w', encoding='utf-8', newline='').write(s2)
print("SUPER ORIGIN SHIPPED")
