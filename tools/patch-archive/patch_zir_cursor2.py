import sys
f = 'netlify/functions/zoho-invoice-reconcile.js'
s = open(f, encoding='utf-8').read()

old1 = "    const invoices = rows.json || [];"
new1 = "    let invoices = rows.json || [];"
if s.count(old1) != 1:
    print(f"ABORTED: invoices decl x{s.count(old1)}"); sys.exit(1)
s = s.replace(old1, new1, 1)

old2 = "    if (invoices.length === 0) return respond(200, { checked: 0, deleted: 0, updated: 0, hasMore: false, message: 'Nothing open in window' });"
new2 = """    if (invoices.length === 0 && after) {
      // End of the treadmill - or a cursor parked past every open row, which UUID
      // ids under id.asc make easy. Either way: clear the cursor and restart from
      // the top IN THIS RUN, so a stale cursor can never blind the reconcile again.
      after = null;
      try {
        await supa('app_config?on_conflict=key', {
          method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify([{ key: 'zoho_reconcile_cursor', value: '' }])
        });
      } catch (e) {}
      const again = await supa(
        `consultant_invoices?balance=gt.1&due_date=gte.${cutoff}&zoho_invoice_id=not.is.null` +
        `&select=id,zoho_invoice_id,customer_name,balance,due_date&order=id.asc&limit=${limit}`
      );
      invoices = again.json || [];
    }
    if (invoices.length === 0) return respond(200, { checked: 0, deleted: 0, updated: 0, hasMore: false, message: 'Nothing open in window' });"""
if s.count(old2) != 1:
    print(f"ABORTED: empty-return anchor x{s.count(old2)}"); sys.exit(1)
s = s.replace(old2, new2, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("RECONCILE CURSOR SELF-HEALS - blind treadmill fixed")
