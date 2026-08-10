import sys
f = 'src/pages/FinancialDashboard.jsx'
s = open(f, encoding='utf-8', errors='surrogateescape').read()

old = "export default function FinancialDashboard() {"
new = """function AuthnetTicker() {
  // Live balance check: what Authorize.net processed today vs what the payment
  // system recorded. Green = balanced to the penny. Red = the difference and
  // which side is missing it. Card money only (Zelle/checks live in Zoho).
  const [d, setD] = React.useState(null);
  React.useEffect(() => {
    const load = () => fetch('/.netlify/functions/authnet-proxy').then((r) => r.json()).then(setD).catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);
  if (!d) return null;
  if (d.error) return <div className="mb-4 px-4 py-3 rounded-lg text-sm font-semibold bg-amber-50 text-amber-700">Auth.net balance check unavailable: {d.error}</div>;
  const fmt = (n) => '$' + (n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const base = `Auth.net today: ${fmt(d.authnet?.total)} (${d.authnet?.count}${d.authnet?.refunds ? `, ${d.authnet.refunds} refund${d.authnet.refunds > 1 ? 's' : ''}` : ''})  |  App: ${fmt(d.app?.total)} (${d.app?.count})`;
  if (d.match) return <div className="mb-4 px-4 py-3 rounded-lg text-sm font-semibold bg-emerald-50 text-emerald-700">{'\u2705'} {base} {'\u2014'} balanced</div>;
  return <div className="mb-4 px-4 py-3 rounded-lg text-sm font-semibold bg-rose-50 text-rose-700">{'\u26A0\uFE0F'} {base} {'\u2014'} {fmt(Math.abs(d.difference || 0))} {(d.difference || 0) > 0 ? 'processed at Auth.net that the system has not recorded' : 'recorded in the system but not seen at Auth.net'}{d.authnet?.errors?.length ? ` (${d.authnet.errors.join('; ')})` : ''}</div>;
}
export default function FinancialDashboard() {"""
if s.count(old) != 1: print(f"ABORTED: component anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)

old = '<h1 className="text-2xl font-bold text-slate-800">Financial Dashboard</h1>'
new = '<h1 className="text-2xl font-bold text-slate-800">Financial Dashboard</h1>\n          <AuthnetTicker />'
if s.count(old) != 1: print(f"ABORTED: h1 anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
print("FinancialDashboard: Auth.net balance ticker wired")
