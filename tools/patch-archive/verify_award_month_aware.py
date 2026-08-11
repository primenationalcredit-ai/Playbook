import sys
s = open('netlify/functions/consultant-bonus-metrics.js', encoding='utf-8').read()
ok = True
for n in ["awardedOrgMonths[`reactivation_kicker:${orgName}`] === String(targetMonth)",
          "awardedOrgMonths[`new_affiliate_launch:${orgName}`] === String(targetMonth)",
          "awardedOrgMonths[`new_affiliate_launch:${o.name}`] !== String(targetMonth)",
          "awardedOrgMonths[`reactivation_kicker:${orgName}`] !== String(targetMonth)"]:
    if n not in s: ok = False; print(f"MISSING: {n}")
# save loop must STILL use the plain full-set check (no double-insert)
if s.count("if (!awardedOrgs.has(`new_affiliate_launch:${org.name}`)) {") != 1: ok = False; print("save-loop launch check altered")
if s.count("if (!awardedOrgs.has(`reactivation_kicker:${org.name}`)) {") != 1: ok = False; print("save-loop kicker check altered")
print('VERDICT:', 'ALL GOOD - safe to push' if ok else 'DO NOT PUSH')
if not ok: sys.exit(1)
