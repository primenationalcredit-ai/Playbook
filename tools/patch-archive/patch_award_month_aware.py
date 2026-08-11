import sys
f = 'netlify/functions/consultant-bonus-metrics.js'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
# 1) build a month map alongside the set
a1 = "    const awardedOrgs = new Set(awardedBonuses.map(a => `${a.bonus_type}:${a.org_name}`));"
if s.count(a1) != 1: print(f"ABORTED: a1 x{s.count(a1)}"); sys.exit(1)
s = s.replace(a1, a1 + """
    // RECOMPUTE-SAFETY (DaShanaye ticket 8/11): an award stamped FOR the target month
    // must not block that month's own recompute - otherwise the first compute pays the
    // one-time bonus, stamps it, and every recompute of that same month erases it
    // (widget then shows "already earned" + $0). Awards from OTHER months still block.
    const awardedOrgMonths = {};
    for (const a of awardedBonuses) { awardedOrgMonths[`${a.bonus_type}:${a.org_name}`] = String(a.awarded_month || ''); }""", 1)
# 2) kicker count site
a2 = "            if (!awardedOrgs.has(`reactivation_kicker:${orgName}`)) {"
if s.count(a2) != 1: print(f"ABORTED: a2 x{s.count(a2)}"); sys.exit(1)
s = s.replace(a2, "            if (!awardedOrgs.has(`reactivation_kicker:${orgName}`) || awardedOrgMonths[`reactivation_kicker:${orgName}`] === String(targetMonth)) {", 1)
# 3) launch count site
a3 = "            if (qualifies && !awardedOrgs.has(`new_affiliate_launch:${orgName}`)) {"
if s.count(a3) != 1: print(f"ABORTED: a3 x{s.count(a3)}"); sys.exit(1)
s = s.replace(a3, "            if (qualifies && (!awardedOrgs.has(`new_affiliate_launch:${orgName}`) || awardedOrgMonths[`new_affiliate_launch:${orgName}`] === String(targetMonth))) {", 1)
# 4) display flags: "already earned" only when earned in a DIFFERENT month
a4 = "          alreadyAwarded: awardedOrgs.has(`new_affiliate_launch:${o.name}`),"
if s.count(a4) != 1: print(f"ABORTED: a4 x{s.count(a4)}"); sys.exit(1)
s = s.replace(a4, "          alreadyAwarded: awardedOrgs.has(`new_affiliate_launch:${o.name}`) && awardedOrgMonths[`new_affiliate_launch:${o.name}`] !== String(targetMonth),", 1)
a5 = "          alreadyAwarded: awardedOrgs.has(`reactivation_kicker:${orgName}`),"
if s.count(a5) != 1: print(f"ABORTED: a5 x{s.count(a5)}"); sys.exit(1)
s = s.replace(a5, "          alreadyAwarded: awardedOrgs.has(`reactivation_kicker:${orgName}`) && awardedOrgMonths[`reactivation_kicker:${orgName}`] !== String(targetMonth),", 1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
print("patched: month-aware award blocking (count sites + display flags; save-dedupe untouched)")
