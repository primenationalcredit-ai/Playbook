import sys
f = 'src/lib/transactionCategorization.js'
s = open(f, encoding='utf-8').read()
if 'OWNER_EXCLUDED_PATTERNS' in s:
    print("lib: already patched (round 1) - skipping")
else:
    print("ABORTED: lib unexpectedly unpatched - stop and report"); sys.exit(1)

f = 'src/pages/DOOPaysheet.jsx'
s = open(f, encoding='utf-8').read()
if 'const txType' not in s:
    old = """      const categorized = categorizeTransaction(t, learnedCategories);
      const amount = Math.abs(t.amount);"""
    new = """      const categorized = categorizeTransaction(t, learnedCategories);
      // The lib returns transactionType; the old .type reads below were dead
      // code, which silently counted card-payment transfers as expenses.
      const txType = categorized.transactionType || categorized.type;
      const amount = Math.abs(t.amount);"""
    if s.count(old) != 1: print(f"ABORTED: paysheet-type anchor x{s.count(old)}"); sys.exit(1)
    s = s.replace(old, new, 1)
old = "if (categorized.type === 'transfer') return;"
if s.count(old) != 1: print(f"ABORTED: transfer-line anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, "if (txType === 'transfer' || txType === 'owner_excluded') return; // owner costs never touch Astrid's P&L (Joe 7/31)", 1)
old = "if (categorized.type === 'cogs') {"
if s.count(old) != 1: print(f"ABORTED: cogs-line anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, "if (txType === 'cogs') {", 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("DOO paysheet: owner costs + transfers out of her expenses, dead checks revived")
