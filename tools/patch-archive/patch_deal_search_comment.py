import sys
f = 'src/pages/ClientFile.jsx'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
old = """      // Pipedrive-style fuzzy search via the crm_client_search RPC:
      // every word matches somewhere, or the name is similar (typo-tolerant), ranked."""
new = """      // Deal-centric fuzzy search via the crm_deal_search RPC: matches deal title
      // OR the client's name/email/phone (typo-tolerant), ranked by closeness."""
if s.count(old) != 1: print(f"ABORTED: comment anchor x{s.count(old)}"); sys.exit(1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s.replace(old, new, 1))
print("comment cleaned")
