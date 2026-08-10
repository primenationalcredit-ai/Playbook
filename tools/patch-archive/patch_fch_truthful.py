import sys
f = 'netlify/functions/final-credit-hook.js'
s = open(f, encoding='utf-8').read()
old = """    if (!toWrite.length) return { statusCode: 200, headers, body: JSON.stringify({ success: true, deal: dealId, client: deal.title, actions, note: 'nothing to write' }) };
    const ins = await fetch(`${SUPABASE_URL}/rest/v1/consultant_bonus_events?on_conflict=deal_id,event_type,event_month`, {"""
new = """    if (!toWrite.length) return { statusCode: 200, headers, body: JSON.stringify({ success: true, deal: dealId, client: deal.title, actions, note: 'nothing to write' }) };
    // Truthful reporting (Joe 7/31): upserts silently no-op on duplicates, so the
    // hook was claiming "events: ..." on every re-check - nightly reports listed
    // every verified client as "healed". Check existence first; only claim real
    // writes. ALSO fixes a live bug: pif and pif_fast_start are distinct rows
    // under the dedupe key - writing plain pif over an existing fast_start
    // would double-credit. The pair counts as one credit here.
    const wantTypes = toWrite.map(t => t.event_type);
    const checkTypes = [...new Set(wantTypes.flatMap(t => (t === 'pif' || t === 'pif_fast_start') ? ['pif', 'pif_fast_start'] : [t]))];
    const exRes = await fetch(`${SUPABASE_URL}/rest/v1/consultant_bonus_events?deal_id=eq.${dealId}&event_month=eq.${month}&event_type=in.(${checkTypes.join(',')})&select=event_type`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    const existing = exRes.ok ? (await exRes.json()).map(e => e.event_type) : [];
    const hasPifAny = existing.includes('pif') || existing.includes('pif_fast_start');
    const newWrites = toWrite.filter(t => (t.event_type === 'pif' || t.event_type === 'pif_fast_start') ? !hasPifAny : !existing.includes(t.event_type));
    if (!newWrites.length) {
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, deal: dealId, client: deal.title, owner: base.owner_name, actions, note: 'already credited (' + wantTypes.join(', ') + ')' }) };
    }
    const ins = await fetch(`${SUPABASE_URL}/rest/v1/consultant_bonus_events?on_conflict=deal_id,event_type,event_month`, {"""
if s.count(old) != 1: print(f"ABORTED: insert anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
old = "      body: JSON.stringify(toWrite)"
if s.count(old) != 1: print(f"ABORTED: body anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, "      body: JSON.stringify(newWrites)", 1)
old = "    actions.push('events: ' + toWrite.map(t => t.event_type).join(', '));"
if s.count(old) != 1: print(f"ABORTED: actions anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, "    actions.push('events: ' + newWrites.map(t => t.event_type).join(', '));", 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("hook v3: truthful heal reporting + pif-variant double-credit guard")
