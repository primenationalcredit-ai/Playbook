import re
s = open('src/pages/Invoices.jsx', encoding='utf-8', errors='surrogateescape').read()

# find all top-level function declarations: "function Name(...) {" or "function Name({...}) {"
matches = list(re.finditer(r'\nfunction (\w+)\(([^)]*)\)\s*\{', s))
print("total function declarations found:", len(matches))
print()

for idx, m in enumerate(matches):
    name = m.group(1)
    params = m.group(2)
    start = m.end()
    end = matches[idx+1].start() if idx+1 < len(matches) else len(s)
    body = s[start:end]
    has_isadmin_in_params = 'isAdmin' in params
    # bare reference: word-boundary isAdmin not part of isAdmin={...} being PASSED to a child (that's fine, means using it)
    # we actually want: does body USE isAdmin as an identifier at all (any way), and does param list declare it
    uses_isadmin = re.search(r'\bisAdmin\b', body) is not None
    if uses_isadmin and not has_isadmin_in_params:
        print(f"*** GAP: function {name}  (line ~{s[:m.start()].count(chr(10))+1})")
        print(f"    params: {params.strip()[:100]}")
        # show first usage context
        um = re.search(r'.{40}\bisAdmin\b.{40}', body)
        if um: print(f"    first use: ...{um.group(0)}...")
        print()
