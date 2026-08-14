import sys
f = 'src/pages/Invoices.jsx'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
a = """      } else if (modal.type === 'refund_initial') {"""
if s.count(a) != 1: print("ABORTED: insert-point anchor x" + str(s.count(a))); sys.exit(1)
branch = """      } else if (modal.type === 'fix_address') {
        if (!form.zip && !form.address) throw new Error('Enter at least a street address or zip');
        await callApi('update_billing_address', { deal_id: modal.deal_id, billingAddress: { address: form.address, city: form.city, state: form.state, zip: form.zip }, cardholderName: modal.client_name });
        setNotice({ type: 'success', text: 'Billing address updated. The card itself was not changed - the next scheduled retry will use the corrected address.' });
""" + a
s = s.replace(a, branch, 1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
print("submit branch added")
