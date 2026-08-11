import sys
f = 'netlify/functions/zoho-invoice-sync-manual.js'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
a = """    if (params.date_start) url += `&date_start=${params.date_start}`;
    if (params.date_end) url += `&date_end=${params.date_end}`;"""
if s.count(a) != 1: print(f"ABORTED: filter anchor x{s.count(a)}"); sys.exit(1)
s = s.replace(a, a + """
    if (params.search) url += `&search_text=${encodeURIComponent(params.search)}`;""", 1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
print("manual door: search_text mode added")
