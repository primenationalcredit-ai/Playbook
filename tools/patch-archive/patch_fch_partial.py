import sys
f = 'netlify/functions/final-credit-hook.js'
s = open(f, encoding='utf-8').read()

old = "    const dealId = String(body.deal_id || '');"
new = """    const dealId = String(body.deal_id || '');
    // kind: 'final' (default) or 'partial'. Rule (Joe): qualified doc = doc fee
    // + (partial OR final) - so a partial clearing must credit instantly too.
    const kind = body.kind === 'partial' ? 'partial' : 'final';"""
if s.count(old) != 1: print(f"ABORTED: kind anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)

old = """    const actions = [];
    // Stamp FINAL_1 from payment truth (caller asserts a final just cleared)
    if (!fieldIs(deal[F.FINAL_1], YES.FINAL_1)) {
      await fetch(`https://api.pipedrive.com/v1/deals/${dealId}?api_token=${PD_KEY}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [F.FINAL_1]: YES.FINAL_1 })
      });
      actions.push('stamped FINAL_1');
    }"""
new = """    const actions = [];
    // Stamp the checkbox that matches the money that just cleared
    const stampField = kind === 'partial' ? F.PARTIAL_1 : F.FINAL_1;
    const stampYes = kind === 'partial' ? YES.PARTIAL_1 : YES.FINAL_1;
    if (!fieldIs(deal[stampField], stampYes)) {
      await fetch(`https://api.pipedrive.com/v1/deals/${dealId}?api_token=${PD_KEY}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [stampField]: stampYes })
      });
      actions.push(`stamped ${kind === 'partial' ? 'PARTIAL_1' : 'FINAL_1'}`);
    }"""
if s.count(old) != 1: print(f"ABORTED: stamp anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)

old = "      doc1, partial1, final1: true,"
new = "      doc1, partial1: kind === 'partial' ? true : partial1, final1: kind === 'final' ? true : fieldIs(deal[F.FINAL_1], YES.FINAL_1),"
if s.count(old) != 1: print(f"ABORTED: base anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)

old = """    const toWrite = [{ ...base, event_type: bizDaysSince(deal.add_time, now) <= 5 ? 'pif_fast_start' : 'pif' }];
    if (doc1) toWrite.push({ ...base, event_type: 'qualified_doc' });
    else actions.push('DOC_1 not set - qualified_doc withheld, watchdog will flag');"""
new = """    const toWrite = [];
    if (kind === 'final') toWrite.push({ ...base, event_type: bizDaysSince(deal.add_time, now) <= 5 ? 'pif_fast_start' : 'pif' });
    if (doc1) toWrite.push({ ...base, event_type: 'qualified_doc' });
    else actions.push('DOC_1 not set - qualified_doc withheld, watchdog will flag');
    if (!toWrite.length) return { statusCode: 200, headers, body: JSON.stringify({ success: true, deal: dealId, client: deal.title, actions, note: 'nothing to write' }) };"""
if s.count(old) != 1: print(f"ABORTED: events anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("HOOK v2: partial payments now credit qualified docs instantly (kind=partial|final)")
