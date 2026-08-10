import sys
f = 'src/lib/transactionCategorization.js'
s = open(f, encoding='utf-8').read()
old = "// Payroll patterns"
new = """// Owner-level costs (Joe 7/31): Meta/Facebook ad spend and attorney fees paid
// through the company card are the owner's costs - they never touch the P&L
// or the DOO compensation basis.
const OWNER_EXCLUDED_PATTERNS = [
  'facebk',
  'facebook',
  'meta ads',
  'metaplatforms',
  'meta platforms',
  'attorney',
  'law office',
  'law offices',
  'law firm',
  'lawyer',
  'legal fee',
  'legal fees'
];
// Payroll patterns"""
if s.count(old) != 1: print(f"ABORTED: patterns anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
old = "  // Check for affiliate revenue (income that's excluded from DOO P&L)"
new = """  // Owner-level costs: out of the P&L entirely (Joe 7/31)
  {
    const searchText = `${transaction.description || ''} ${transaction.merchant_name || ''}`.toLowerCase();
    if (transaction.amount > 0 && OWNER_EXCLUDED_PATTERNS.some(p => searchText.includes(p))) {
      return {
        category: 'Owner Cost (excluded)',
        transactionType: 'owner_excluded',
        confidence: 0.97,
        isAffiliateRevenue: false,
        needsReview: false
      };
    }
  }
  // Check for affiliate revenue (income that's excluded from DOO P&L)"""
if s.count(old) != 1: print(f"ABORTED: categorize anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
old = """    if (txn.transactionType === 'transfer') {
      summary.transfersExcluded += Math.abs(txn.amount);
      return;
    }"""
new = """    if (txn.transactionType === 'transfer') {
      summary.transfersExcluded += Math.abs(txn.amount);
      return;
    }
    // Owner-level costs: excluded from P&L and DOO comp entirely (Joe 7/31)
    if (txn.transactionType === 'owner_excluded') {
      summary.ownerExcluded = (summary.ownerExcluded || 0) + Math.abs(txn.amount);
      return;
    }"""
if s.count(old) != 1: print(f"ABORTED: calculatePL anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("categorizer: owner costs excluded from P&L")

f = 'src/pages/DOOPaysheet.jsx'
s = open(f, encoding='utf-8').read()
old = """      const categorized = categorizeTransaction(t, learnedCategories);
      const amount = Math.abs(t.amount);"""
new = """      const categorized = categorizeTransaction(t, learnedCategories);
      // The lib returns transactionType; the old .type reads below were dead
      // code, which silently counted card-payment transfers as expenses.
      const txType = categorized.transactionType || categorized.type;
      const amount = Math.abs(t.amount);"""
if s.count(old) != 1: print(f"ABORTED: paysheet-type anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
old = """        // Skip transfers
        if (categorized.type === 'transfer') return;
        if (categorized.type === 'cogs') {"""
new = """        // Skip transfers and owner-level costs (Joe 7/31: Meta ads +
        // attorney fees on the card never touch Astrid's P&L)
        if (txType === 'transfer' || txType === 'owner_excluded') return;
        if (txType === 'cogs') {"""
if s.count(old) != 1: print(f"ABORTED: paysheet-skip anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("DOO paysheet: owner costs + transfers out of her expenses, dead checks revived")
