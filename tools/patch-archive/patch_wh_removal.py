import sys
f = 'netlify/functions/cs-deals-webhook.js'
s = open(f, encoding='utf-8').read()
old = """    // GUARD (7/24): a failed/partial deal fetch resolves to null - that must
    // never erase a site we already know. Blanks add nothing; they don't erase.
    if (!monitoringSite && existing && existing.monitoring_site) monitoringSite = existing.monitoring_site;"""
new = """    // GUARD (7/24), refined 8/4 (Walter Wilkerson): a FAILED deal fetch must
    // never erase a site we know - but a SUCCESSFUL fetch showing the field
    // empty is a genuine removal (someone corrected a premature entry) and
    // MUST clear through, stamps included, or the Playbook keeps counting a
    // report that does not exist and the team's correction is silently ignored.
    let siteRemoved = false;
    if (!monitoringSite && existing && existing.monitoring_site) {
      if (freshDeal) siteRemoved = true;
      else monitoringSite = existing.monitoring_site;
    }"""
if s.count(old) != 1: print(f"ABORTED: guard anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
old = """    let monitoringSiteSetAt = existing && existing.monitoring_site_set_at ? existing.monitoring_site_set_at : null;
    let monitoringSiteSetPipeline = existing && existing.monitoring_site_set_pipeline ? existing.monitoring_site_set_pipeline : null;
    let monitoringSiteSetStage = existing && existing.monitoring_site_set_stage ? existing.monitoring_site_set_stage : null;"""
new = """    let monitoringSiteSetAt = existing && existing.monitoring_site_set_at ? existing.monitoring_site_set_at : null;
    let monitoringSiteSetPipeline = existing && existing.monitoring_site_set_pipeline ? existing.monitoring_site_set_pipeline : null;
    let monitoringSiteSetStage = existing && existing.monitoring_site_set_stage ? existing.monitoring_site_set_stage : null;
    if (siteRemoved) { monitoringSiteSetAt = null; monitoringSiteSetPipeline = null; monitoringSiteSetStage = null; }"""
if s.count(old) != 1: print(f"ABORTED: stamps anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("removals clear through: correcting a premature monitoring site un-counts the report everywhere")
