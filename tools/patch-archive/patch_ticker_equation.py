import sys
f = 'src/pages/ConsultantPayments.jsx'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
old = """  const base = `Auth.net today: ${fmt(d.authnet?.total)} (${d.authnet?.count}${d.authnet?.refunds ? `, ${d.authnet.refunds} refund${d.authnet.refunds > 1 ? 's' : ''}` : ''})  |  App: ${fmt(d.app?.total)} (${d.app?.count})`;"""
new = """  // Show the whole equation (Joe 8/10: "how is this balanced? I don't get it") -
  // the check compares Auth.net against app charges PLUS Zoho pay-link charges,
  // so the label must say so or the numbers look wrong at a glance.
  const zoho = d.app?.zoho || {};
  const ext = d.app?.external || {};
  const base = `Auth.net today: ${fmt(d.authnet?.total)} (${d.authnet?.count}${d.authnet?.refunds ? `, ${d.authnet.refunds} refund${d.authnet.refunds > 1 ? 's' : ''}` : ''}) = App ${fmt(d.app?.total)} (${d.app?.count})${zoho.count ? ` + Zoho links ${fmt(zoho.total)} (${zoho.count})` : ''}${ext.count ? `  \u00b7  Zelle/external: ${fmt(ext.total)} (${ext.count})` : ''}`;"""
if s.count(old) != 1: print(f"ABORTED: anchor x{s.count(old)}"); sys.exit(1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s.replace(old, new, 1))
print("ticker strip: full equation shown")
