import sys
f = 'src/pages/Invoices.jsx'
s = open(f, encoding='utf-8').read()
old = """      {r.pipedrive_deal_id && (
        <a href={DEAL_URL(r.pipedrive_deal_id)} target="_blank" rel="noreferrer" className="shrink-0 text-asap-blue hover:underline inline-flex items-center gap-1 text-xs font-semibold">
          Deal <ExternalLink size={11} />
        </a>
      )}"""
new = """      {r.zoho_invoice_id && (
        <a href={`https://invoice.zoho.com/app#/invoices/${r.zoho_invoice_id}`} target="_blank" rel="noreferrer" className="shrink-0 text-emerald-700 hover:underline inline-flex items-center gap-1 text-xs font-semibold">
          Invoice <ExternalLink size={11} />
        </a>
      )}
      {r.pipedrive_deal_id && (
        <a href={DEAL_URL(r.pipedrive_deal_id)} target="_blank" rel="noreferrer" className="shrink-0 text-asap-blue hover:underline inline-flex items-center gap-1 text-xs font-semibold">
          Deal <ExternalLink size={11} />
        </a>
      )}"""
if s.count(old) != 1: print(f"ABORTED: BillingRow anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("BillingRow: Invoice link next to Deal on every billing card")
