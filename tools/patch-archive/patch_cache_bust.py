import sys
f = 'netlify/functions/final-credit-hook.js'
s = open(f, encoding='utf-8').read()
old = "    actions.push('events: ' + toWrite.map(t => t.event_type).join(', '));"
new = """    actions.push('events: ' + toWrite.map(t => t.event_type).join(', '));
    // Bust the bonus-metrics cache so dashboards reflect this credit immediately
    // (the page serves a cached payload; browser refresh alone never rebuilds it).
    fetch(`https://cute-cat-d9631c.netlify.app/.netlify/functions/consultant-bonus-metrics?month=${month}&refresh=1`).catch(() => {});"""
if s.count(old) != 1: print(f"ABORTED: hook anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)

f2 = 'netlify/functions/qualified-doc-watchdog.js'
s2 = open(f2, encoding='utf-8').read()
old2 = "    // 6) Leave the morning report where humans and dashboards can read it"
new2 = """    // 5.5) Anything healed -> bust the bonus-metrics cache so dashboards update
    if (report.healed.length && !dryRun) {
      fetch(`https://cute-cat-d9631c.netlify.app/.netlify/functions/consultant-bonus-metrics?month=${month}&refresh=1`).catch(() => {});
    }
    // 6) Leave the morning report where humans and dashboards can read it"""
if s2.count(old2) != 1: print(f"ABORTED: watchdog anchor x{s2.count(old2)}"); sys.exit(1)
s2 = s2.replace(old2, new2, 1)
open(f2, 'w', encoding='utf-8', newline='').write(s2)
print("CACHE AUTO-BUST: hook + watchdog rebuild bonus metrics after every credit write")
