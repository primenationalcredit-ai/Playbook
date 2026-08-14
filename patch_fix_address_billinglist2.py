import sys
f = 'src/pages/Invoices.jsx'
s = open(f, encoding='utf-8', errors='surrogateescape').read()

# ---- 1) undo the dead onFixAddress prop-call from the last patch, replace with a real function ----
a1 = """        <button onClick={() => onFixAddress ? onFixAddress(r) : null} disabled={busy || charging}
          title="Correct the billing address on file without touching the card itself"
          className="text-[11px] font-semibold px-2 py-1 rounded-lg border border-asap-blue text-asap-blue hover:bg-blue-50 disabled:opacity-50 whitespace-nowrap">
          Fix Address
        </button>"""
if s.count(a1) != 1: print("ABORTED: prior dead-handler button not found x" + str(s.count(a1))); sys.exit(1)
s = s.replace(a1, """        <button onClick={fixAddress} disabled={fixing || charging}
          title="Correct the billing address on file without touching the card itself"
          className="text-[11px] font-semibold px-2 py-1 rounded-lg border border-asap-blue text-asap-blue hover:bg-blue-50 disabled:opacity-50 whitespace-nowrap">
          {fixing ? 'Saving...' : 'Fix Address'}
        </button>""", 1)

# ---- 2) add the fixAddress function + fixing state, right after chargeNow ----
a2 = """  const badge = attempts === 0"""
if s.count(a2) != 1: print("ABORTED: insert-point anchor x" + str(s.count(a2))); sys.exit(1)
fn = """  const [fixing, setFixing] = useState(false);
  const fixAddress = async () => {
    if (fixing) return;
    const address = window.prompt(`Street address for ${r.client_name || 'this client'}:`);
    if (address === null) return;
    const city = window.prompt('City:');
    if (city === null) return;
    const state = window.prompt('State (2-letter):');
    if (state === null) return;
    const zip = window.prompt('Zip code:');
    if (zip === null) return;
    if (!address && !zip) { alert('Enter at least a street address or zip.'); return; }
    setFixing(true);
    try {
      await callApi('update_billing_address', {
        deal_id: r.pipedrive_deal_id,
        billingAddress: { address, city, state, zip },
        cardholderName: r.client_name
      });
      alert('Billing address updated. Card was not touched - the next retry will use the corrected address.');
    } catch (e) {
      alert('Could not update address: ' + (e.message || e));
    }
    setFixing(false);
  };
  const badge = attempts === 0"""
s = s.replace(a2, fn, 1)

open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
print("BillingList: real fixAddress function wired")
