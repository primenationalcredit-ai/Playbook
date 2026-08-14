import sys, re
f = 'src/pages/Invoices.jsx'
s = open(f, encoding='utf-8', errors='surrogateescape').read()

if 'qualifiedDoc={qualifiedDoc} />' in s:
    print("qualifiedDoc already wired to DealView - skipping (already done in a prior run)")
else:
    a6 = "<DealView data={dealData} isAdmin={isAdmin} canRequest={canRequest} onAction={openAction} pendingByCharge"
    m = re.search(re.escape(a6) + r'[^\n]*', s)
    if not m: print("ABORTED: DealView call-site line not found"); sys.exit(1)
    line = m.group(0)
    print("exact line found: " + repr(line))
    trailer = ''
    core = line
    while core.endswith('}') and not core.endswith('/>'):
        core = core[:-1]
        trailer += '}'
    if not core.rstrip().endswith('/>'):
        print("ABORTED: could not isolate /> even after stripping trailers: " + repr(line)); sys.exit(1)
    core_stripped = core.rstrip()
    new_core = core_stripped[:-2].rstrip() + ' qualifiedDoc={qualifiedDoc} />'
    new_line = new_core + trailer
    s = s.replace(line, new_line, 1)
    open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
    print("qualifiedDoc passed to DealView call site: " + repr(new_line))
