import sys
f = 'src/pages/ClientFile.jsx'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
old = """      const safe = q.replace(/[%,()]/g, ' ').trim();
      const { data } = await supabase.from('crm_clients')
        .select('pipedrive_person_id,name,email,phone,current_status,account_manager_name,owner_name')
        .or(`name.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%`)
        .eq('deleted', false).limit(20);
      setResults(data || []);"""
new = """      // Pipedrive-style fuzzy search via the crm_client_search RPC:
      // every word matches somewhere, or the name is similar (typo-tolerant), ranked.
      const { data, error } = await supabase.rpc('crm_client_search', { q });
      if (error) console.error('client search error:', error);
      setResults(data || []);"""
if s.count(old) != 1: print(f"ABORTED: search anchor x{s.count(old)}"); sys.exit(1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s.replace(old, new, 1))
print("ClientFile: fuzzy RPC search in, errors surfaced")
