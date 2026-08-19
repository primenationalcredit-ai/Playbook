import sys
def abort(m):
    print("ABORTED: " + m); sys.exit(1)

f = "netlify/functions/zoho-payment-sync.js"
s = open(f, encoding="utf-8", errors="surrogateescape").read()

a = """            const inv = invList.invoices[0];
            // Get deal_id from company_name
            // Deal resolution (Joe 7/24): invoice's own reference first; the
            // customer-level company_name is stale for repeat clients, so any
            // deal it names must be verified - not open + person has an open
            // deal => the payment belongs to the newest OPEN deal instead.
            dealId = parseDealId(inv.reference_number) || null;
            if (!dealId) {
              const cnDeal = parseDealId(inv.company_name);
              if (cnDeal) {
                dealId = cnDeal;
                try {
                  const pdTok = process.env.PIPEDRIVE_API_KEY || process.env.PIPEDRIVE_API_TOKEN;
                  const dRes = await fetch(`https://asapcreditrepairusa.pipedrive.com/api/v1/deals/${cnDeal}?api_token=${pdTok}`);
                  const dj = await dRes.json().catch(() => null);
                  const d = dj && dj.data;
                  const personId = d && d.person_id && (d.person_id.value || d.person_id);
                  if (personId && d.status !== 'open') {
                    const odRes = await fetch(`https://asapcreditrepairusa.pipedrive.com/api/v1/persons/${personId}/deals?status=open&limit=50&api_token=${pdTok}`);
                    const odj = await odRes.json().catch(() => null);
                    const open = (odj && odj.data) || [];
                    if (open.length) {
                      open.sort((a, b) => String(b.update_time || '').localeCompare(String(a.update_time || '')));
                      dealId = open[0].id;
                    }
                  }
                } catch (e) { /* verification failure keeps cnDeal - never blocks the payment import */ }
              }
            }"""
if s.count(a) != 1: abort("anchor x" + str(s.count(a)))

b = """            const inv = invList.invoices[0];
            // Deal resolution (Joe 8/18, Michael Cook mix-up): company_name is Zoho's
            // OWN deliberate, structured convention - "<dealId> <personId>" - set up
            // specifically to link an invoice back to Pipedrive reliably. This is now
            // the PRIMARY source, verified against Pipedrive's real person_id on the
            // resolved deal, since two different real clients can share the exact same
            // name and a name-based/free-text guess has no way to tell them apart.
            // reference_number (previously primary, unverified) is now only a last-resort
            // fallback when company_name doesn't carry the expected two-number format.
            const cnNums = String(inv.company_name || '').match(/\\d{4,}/g) || [];
            const cnDeal = cnNums[0] || null;
            const cnPerson = cnNums[1] || null;
            if (cnDeal) {
              dealId = cnDeal;
              try {
                const pdTok = process.env.PIPEDRIVE_API_KEY || process.env.PIPEDRIVE_API_TOKEN;
                const dRes = await fetch(`https://asapcreditrepairusa.pipedrive.com/api/v1/deals/${cnDeal}?api_token=${pdTok}`);
                const dj = await dRes.json().catch(() => null);
                const d = dj && dj.data;
                const personId = d && d.person_id && (d.person_id.value || d.person_id);
                if (cnPerson && personId && String(personId) !== String(cnPerson)) {
                  // The deal number parsed but its real owner doesn't match the invoice's
                  // own embedded person_id - two different real clients likely share this
                  // name. Do not trust this deal id at all; fall through to reference_number.
                  console.error(`zoho-payment-sync: person_id mismatch for deal ${cnDeal} - invoice says person ${cnPerson}, Pipedrive says ${personId}. Discarding company_name match.`);
                  dealId = null;
                } else if (personId && d.status !== 'open') {
                  const odRes = await fetch(`https://asapcreditrepairusa.pipedrive.com/api/v1/persons/${personId}/deals?status=open&limit=50&api_token=${pdTok}`);
                  const odj = await odRes.json().catch(() => null);
                  const open = (odj && odj.data) || [];
                  if (open.length) {
                    open.sort((a, b) => String(b.update_time || '').localeCompare(String(a.update_time || '')));
                    dealId = open[0].id;
                  }
                }
              } catch (e) { /* verification failure keeps cnDeal - never blocks the payment import */ }
            }
            if (!dealId) dealId = parseDealId(inv.reference_number) || null;"""
s = s.replace(a, b, 1)
open(f, "w", encoding="utf-8", errors="surrogateescape", newline="").write(s)
print("patched")
