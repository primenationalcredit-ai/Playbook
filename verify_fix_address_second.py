import sys
s = open('src/pages/Invoices.jsx', encoding='utf-8', errors='surrogateescape').read()
n = s.count("Fix Address")
print("VERDICT:", "ALL GOOD - safe to push" if n == 2 else "DO NOT PUSH (count=" + str(n) + ")")
sys.exit(0 if n == 2 else 1)
