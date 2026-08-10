import sys
f = 'src/pages/Invoices.jsx'
s = open(f, encoding='utf-8').read()
old = """      {r.zoho_invoice_id && (
        <a href={`https://invoice.zoho.com/app#/invoices/${r.zoho_invoice_id}`} target="_blank" rel="noreferrer" className="shrink-0 text-emerald-700 hover:underline inline-flex items-center gap-1 text-xs font-semibold">
          Invoice <ExternalLink size={11} />
        </a>
      )}"""
new = """      {r.pipedrive_deal_id && (
        <a href={`?deal=${r.pipedrive_deal_id}`} className="shrink-0 text-emerald-700 hover:underline inline-flex items-center gap-1 text-xs font-semibold">
          Client page
        </a>
      )}"""
if s.count(old) != 1: print(f"ABORTED: link anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("billing cards: Client page opens their in-app profile (charges + Charge Now)")
