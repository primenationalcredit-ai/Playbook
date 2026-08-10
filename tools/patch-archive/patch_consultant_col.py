import sys

# 1) invoices-api: stamp consultant_name on every token/charge row
f = 'netlify/functions/invoices-api.js'
s = open(f, encoding='utf-8', errors='surrogateescape').read()

old = "exports.handler = async (event) => {"
new = """// Consultant column (Astrid 8/7): stamp each token/charge with the consultant
// who sold the deal. consultant_payments already maps deal -> consultant_name
// (Zoho-derived, same source the bonus math uses), so this is one bulk read -
// no Pipedrive calls. Fail-open: the list still returns without the names.
async function addConsultantNames(data) {
  const SU = process.env.SUPABASE_URL, SK = process.env.SUPABASE_SERVICE_KEY;
  if (!SU || !SK) return data;
  const H = { apikey: SK, Authorization: `Bearer ${SK}` };
  try {
    const ids = [...new Set([...(data.tokens || []), ...(data.charges || [])].map(x => x.pipedrive_deal_id).filter(Boolean))];
    const map = {};
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      const rows = await fetch(`${SU}/rest/v1/consultant_payments?pipedrive_deal_id=in.(${chunk.join(',')})&select=pipedrive_deal_id,consultant_name`, { headers: H }).then(r => r.json());
      for (const r of (Array.isArray(rows) ? rows : [])) { if (r.consultant_name && !map[r.pipedrive_deal_id]) map[r.pipedrive_deal_id] = r.consultant_name; }
    }
    for (const t of (data.tokens || [])) t.consultant_name = map[t.pipedrive_deal_id] || null;
    for (const c of (data.charges || [])) c.consultant_name = map[c.pipedrive_deal_id] || null;
  } catch (e) { console.error('consultant name enrich failed (list returns without it):', e); }
  return data;
}
exports.handler = async (event) => {"""
if s.count(old) != 1: print(f"ABORTED: handler anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)

old = """    if (action === 'list_recent_invoices' && upstream.ok && playbookUser && playbookUser.email) {
      let listData = null;
      try { listData = JSON.parse(text); } catch (e) {}
      if (listData && Array.isArray(listData.tokens)) {
        listData = await scopeInvoicesForAM(listData, playbookUser.email);
        return { statusCode: 200, headers, body: JSON.stringify(listData) };
      }
    }"""
new = """    if (action === 'list_recent_invoices' && upstream.ok) {
      let listData = null;
      try { listData = JSON.parse(text); } catch (e) {}
      if (listData && Array.isArray(listData.tokens)) {
        if (playbookUser && playbookUser.email) listData = await scopeInvoicesForAM(listData, playbookUser.email);
        listData = await addConsultantNames(listData);
        return { statusCode: 200, headers, body: JSON.stringify(listData) };
      }
    }"""
if s.count(old) != 1: print(f"ABORTED: list anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
print("invoices-api: consultant names stamped on every row")

# 2) Invoices.jsx: the Consultant column (header + cell)
f = 'src/pages/Invoices.jsx'
s = open(f, encoding='utf-8', errors='surrogateescape').read()

old = '<th className="text-left px-3 py-2">Client</th>'
new = '<th className="text-left px-3 py-2">Client</th>\n                <th className="text-left px-3 py-2">Consultant</th>'
if s.count(old) != 1: print(f"ABORTED: th anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)

old = """                    <td className="px-3 py-2">
                      <p className="font-semibold text-slate-800">{i.client_name || 'Unknown'}</p>
                      {i.client_email && <p className="text-[11px] text-slate-500">{i.client_email}</p>}
                    </td>"""
new = """                    <td className="px-3 py-2">
                      <p className="font-semibold text-slate-800">{i.client_name || 'Unknown'}</p>
                      {i.client_email && <p className="text-[11px] text-slate-500">{i.client_email}</p>}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">{i.consultant_name || '\\u2014'}</td>"""
if s.count(old) != 1: print(f"ABORTED: td anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
print("Invoices.jsx: Consultant column added")
