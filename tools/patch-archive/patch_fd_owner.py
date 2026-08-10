import sys
f = 'src/pages/FinancialDashboard.jsx'
s = open(f, encoding='utf-8').read()
old = """    // 1. FIRST: Check user's learned categories (100% confidence)"""
new = """    // 0. OWNER COSTS (Joe 7/31): Meta/Facebook ad spend + attorney fees on
    // the card are owner-level - excluded from the P&L exactly like transfers.
    // Runs BEFORE learned categories so an old hand-taught 'facebook ->
    // Advertising' rule can't pull these back into the expenses.
    if (amount > 0) {
      const OWNER_COST_PATTERNS = ['facebk', 'facebook', 'meta ads', 'metaplatforms', 'meta platforms', 'attorney', 'law office', 'law offices', 'law firm', 'lawyer', 'legal fee', 'legal fees'];
      for (const pattern of OWNER_COST_PATTERNS) {
        if (combined.includes(pattern)) {
          return { category: 'Owner Cost (excluded)', transactionType: 'transfer', confidence: 0.97, source: 'rule' };
        }
      }
    }
    // 1. FIRST: Check user's learned categories (100% confidence)"""
if s.count(old) != 1: print(f"ABORTED: FD anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', newline='')..write(s) if False else open(f, 'w', encoding='utf-8', newline='').write(s)
print("Financial Dashboard: owner costs out of the P&L, immune to learned overrides")
