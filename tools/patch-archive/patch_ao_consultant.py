import sys
f = 'src/pages/AffiliateOutreach.jsx'
s = open(f, encoding='utf-8').read()

# 1. loadSummary: consultants' counters reflect only their own affiliates
old = """    const [orgs, cfg] = await Promise.all([
      sbGet('affiliate_orgs?select=segment,paused,opted_out,super_affiliate,missing_contact'),
      sbGet('app_config?select=key,value'),
    ]);"""
new = """    const myFirst = String(currentUser?.name || '').trim().toLowerCase().split(/\\s+/)[0];
    const ownerQ = (isLeadership || !myFirst) ? '' : `&owner_name=ilike.${encodeURIComponent(myFirst)}*`;
    const [orgs, cfg] = await Promise.all([
      sbGet(`affiliate_orgs?select=segment,paused,opted_out,super_affiliate,missing_contact${ownerQ}`),
      sbGet('app_config?select=key,value'),
    ]);"""
if s.count(old) != 1: print(f"ABORTED: summary anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)

old = """    setConfig(cf);
  }, []);"""
new = """    setConfig(cf);
  }, [isLeadership, currentUser]);"""
if s.count(old) != 1: print(f"ABORTED: summary deps x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)

# 2. loadBook: consultants see only their own affiliates
old = """    let q = `affiliate_orgs?select=*&order=pipedrive_add_time.desc&limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`;
    const filters = [];"""
new = """    let q = `affiliate_orgs?select=*&order=pipedrive_add_time.desc&limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`;
    const filters = [];
    const myFirst = String(currentUser?.name || '').trim().toLowerCase().split(/\\s+/)[0];
    if (!isLeadership && myFirst) filters.push(`owner_name=ilike.${encodeURIComponent(myFirst)}*`);"""
if s.count(old) != 1: print(f"ABORTED: book anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)

old = "  }, [segFilter, search, page]);"
new = "  }, [segFilter, search, page, isLeadership, currentUser]);"
if s.count(old) != 1: print(f"ABORTED: book deps x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)

# 3. pause/resume: leadership only
old = """                          <button onClick={() => togglePause(a)} title={a.paused ? 'Resume cadence' : 'Pause cadence'}
                            className="p-1.5 rounded hover:bg-gray-200 mr-1">
                            {a.paused ? <Play className="w-4 h-4 text-green-600" /> : <Pause className="w-4 h-4 text-gray-500" />}
                          </button>"""
new = """                          {isLeadership && (
                          <button onClick={() => togglePause(a)} title={a.paused ? 'Resume cadence' : 'Pause cadence'}
                            className="p-1.5 rounded hover:bg-gray-200 mr-1">
                            {a.paused ? <Play className="w-4 h-4 text-green-600" /> : <Pause className="w-4 h-4 text-gray-500" />}
                          </button>
                          )}"""
if s.count(old) != 1: print(f"ABORTED: pause anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)

open(f, 'w', encoding='utf-8', newline='').write(s)
print("CONSULTANT VIEW LOCKED: own affiliates only (book + counters), no pause, caps already gated")
