import sys
f = "netlify/functions/consultant-bonus-metrics.js"
s = open(f, encoding="utf-8", errors="surrogateescape").read()

# 1) Remove the entire mirror function definition block
a1 = """    // ===== PAYSHEET MIRROR (shared) =====
    // The Payment Dashboard reads the Google Sheet (paysheet-live) and is the source of truth for MTD
    // sales. This rewrites each consultant's totalSales (MTD) and today.sales to match the paysheet,
    // so the leaderboard equals the Payment Dashboard. Applied to BOTH fresh and cached responses.
    const mirrorTodayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    let paysheetTotals = null; // { mtdSales, todaySales, mtdDocs, mtdPartials, mtdFinals } from the paysheet
    const applyPaysheetMirror = async (consultantsObj) => {"""
i1 = s.find(a1)
if i1 == -1:
    print("ABORTED: block-1 start not found")
    sys.exit(1)
end_marker = "// ===== END PAYSHEET MIRROR (shared) ====="
i1_end = s.find(end_marker, i1)
if i1_end == -1:
    print("ABORTED: block-1 end marker not found")
    sys.exit(1)
i1_end += len(end_marker)
removed_1 = s[i1:i1_end]
s = s[:i1] + "    // Google Sheets paysheet mirror removed (Joe 8/17) - MTD now comes only from live consultant_payments, never a spreadsheet." + s[i1_end:]

# 2) Simplify the cache-hit path: no more mirror, just return the cache as-is
a2 = """        if (!forceRefresh && !params.duedebug) {
          // Always serve cache on the live page load, even if a little stale. The scheduled warm
          // function (and ?refresh=1) do the slow recompute, so the team never blocks on it and the
          // page never fails to load. Freshness comes from the every-10-min warm.
          // Still apply the paysheet mirror to the cached body so MTD always matches the Payment Dashboard.
          try {
            const cachedObj = JSON.parse(priorCacheBody);
            if (cachedObj && cachedObj.consultants) {
              await applyPaysheetMirror(cachedObj.consultants);
              if (paysheetTotals && cachedObj.teamTotals) {
                cachedObj.teamTotals.mtdSales = paysheetTotals.mtdSales;
                cachedObj.teamTotals.todaySales = paysheetTotals.todaySales;
                cachedObj.teamTotals.mtdDocs = paysheetTotals.mtdDocs;
                cachedObj.teamTotals.mtdPartials = paysheetTotals.mtdPartials;
                cachedObj.teamTotals.mtdFinals = paysheetTotals.mtdFinals;
              }
              return { statusCode: 200, headers, body: JSON.stringify(cachedObj) };
            }
          } catch (_) { /* fall through to raw cache if parse/mirror fails */ }
          return { statusCode: 200, headers, body: priorCacheBody };
        }"""
if s.count(a2) != 1:
    print("ABORTED: block-2 anchor x" + str(s.count(a2)))
    sys.exit(1)
b2 = """        if (!forceRefresh && !params.duedebug) {
          // Always serve cache on the live page load, even if a little stale. The scheduled warm
          // function (and ?refresh=1) do the slow recompute, so the team never blocks on it and the
          // page never fails to load. Freshness comes from the every-10-min warm.
          return { statusCode: 200, headers, body: priorCacheBody };
        }"""
s = s.replace(a2, b2, 1)

# 3) Remove the fresh-compute call site
a3 = """    // Apply the paysheet mirror to the freshly computed results before caching/returning.
    await applyPaysheetMirror(results);
    // Override company totals from the paysheet so the leaderboard's company MTD matches the
    // Payment Dashboard exactly (the per-consultant numbers were mirrored inside the function).
    const teamMtdSales = paysheetTotals ? paysheetTotals.mtdSales : mtdSales;
    const teamTodaySales = paysheetTotals ? paysheetTotals.todaySales : todaySales;
    const teamMtdDocs = paysheetTotals ? paysheetTotals.mtdDocs : mtdDocs;
    const teamMtdPartials = paysheetTotals ? paysheetTotals.mtdPartials : mtdPartials;
    const teamMtdFinals = paysheetTotals ? paysheetTotals.mtdFinals : mtdFinals;"""
if s.count(a3) != 1:
    print("ABORTED: block-3 anchor x" + str(s.count(a3)))
    sys.exit(1)
b3 = """    // Live, from real transactions only - no Google Sheet involved (Joe 8/17).
    const teamMtdSales = mtdSales;
    const teamTodaySales = todaySales;
    const teamMtdDocs = mtdDocs;
    const teamMtdPartials = mtdPartials;
    const teamMtdFinals = mtdFinals;"""
s = s.replace(a3, b3, 1)

open(f, "w", encoding="utf-8", errors="surrogateescape", newline="").write(s)
print("all three edits applied - MTD sheet dependency fully removed")
