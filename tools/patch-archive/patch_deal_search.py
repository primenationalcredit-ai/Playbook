import sys
f = 'src/pages/ClientFile.jsx'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
reps = [
    ("""const { data, error } = await supabase.rpc('crm_client_search', { q });""",
     """const { data, error } = await supabase.rpc('crm_deal_search', { q });"""),
    ("""  const openClient = async (row) => {""",
     """  const openClient = async (row, focusDealId) => {"""),
    ("""    const dealList = ds || [];""",
     """    const dealList = (ds || []).sort((a, b) => (b.pipedrive_deal_id === focusDealId ? 1 : 0) - (a.pipedrive_deal_id === focusDealId ? 1 : 0));"""),
    ("""              <button key={r.pipedrive_person_id} onClick={() => openClient(r)} className="w-full text-left px-4 py-2 hover:bg-blue-50 border-b last:border-b-0">""",
     """              <button key={r.pipedrive_deal_id} onClick={() => openClient({ pipedrive_person_id: r.pipedrive_person_id, name: r.person_name }, r.pipedrive_deal_id)} className="w-full text-left px-4 py-2 hover:bg-blue-50 border-b last:border-b-0">"""),
    ("""                <div className="font-medium">{r.name}</div>""",
     """                <div className="font-medium">{r.title} <span className="text-xs text-gray-400">#{r.pipedrive_deal_id}</span></div>"""),
    ("""                <div className="text-xs text-gray-500">{r.email || 'no email'} {r.phone ? `- ${r.phone}` : ''} {r.account_manager_name ? `- AM: ${r.account_manager_name}` : ''}</div>""",
     """                <div className="text-xs text-gray-500">{r.person_name || 'no person'} {r.email ? `- ${r.email}` : ''} {r.phone ? `- ${r.phone}` : ''}</div>"""),
    ("""                  {r.latest_stage && <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{r.latest_stage}</span>}""",
     """                  {r.stage_name && <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{r.stage_name}</span>}"""),
    ("""                  {r.latest_deal_status && <span className={`px-1.5 py-0.5 rounded ${r.latest_deal_status === 'won' ? 'bg-emerald-50 text-emerald-700' : r.latest_deal_status === 'lost' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-700'}`}>{r.latest_deal_status}</span>}""",
     """                  {r.status && <span className={`px-1.5 py-0.5 rounded ${r.status === 'won' ? 'bg-emerald-50 text-emerald-700' : r.status === 'lost' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-700'}`}>{r.status}</span>}"""),
    ("""        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name, email, or phone..."""",
     """        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search deals by client name, deal title, email, or phone..."""")
]
for a, b in reps:
    if s.count(a) != 1: print(f"ABORTED: anchor x{s.count(a)}: {a[:70]}"); sys.exit(1)
    s = s.replace(a, b, 1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
print("ClientFile: deal-centric search in (9 replacements)")
