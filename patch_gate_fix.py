import sys
f='src/pages/LeadershipProjects.jsx'; s=open(f,encoding='utf-8',errors='surrogateescape').read()
if 'genSOP(false)' in s: print("SKIP: already fixed"); sys.exit(0)
a="<button onClick={genSOP} disabled={sopBusy}"
if s.count(a)!=1: print("ABORT button anchor x"+str(s.count(a))); sys.exit(1)
s=s.replace(a, "<button onClick={() => genSOP(false)} disabled={sopBusy}",1)
b="  const genSOP = async (sopConfirmOverride) => {\n    if (sopBusy) return; setSopBusy(true);"
if s.count(b)!=1: print("ABORT genSOP anchor x"+str(s.count(b))); sys.exit(1)
s=s.replace(b, """  const genSOP = async (sopConfirmOverride) => {
    // GATE FIX (Joe 8/13): onClick={genSOP} handed React's click event in as the
    // override, which is truthy, so every click sent confirm:true and the phase
    // gate never fired. Button now passes false explicitly; this stays strict so
    // no future caller can bypass the gate by accident.
    const confirmed = sopConfirmOverride === true;
    if (sopBusy) return; setSopBusy(true);""",1)
c="body: JSON.stringify({ action: 'start', card_id: card.id, confirm: !!sopConfirmOverride }) });"
if s.count(c)!=1: print("ABORT body anchor x"+str(s.count(c))); sys.exit(1)
s=s.replace(c, "body: JSON.stringify({ action: 'start', card_id: card.id, confirm: confirmed }) });",1)
open(f,'w',encoding='utf-8',errors='surrogateescape',newline='').write(s)
print("phase gate fixed: button passes false, override must be strictly true")
