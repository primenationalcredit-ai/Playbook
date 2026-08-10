import sys
f = 'src/pages/ClientFile.jsx'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
old = """      const { data, error } = await supabase.rpc('crm_client_search', { q });
      if (error) console.error('client search error:', error);
      setResults(data || []);"""
new = """      const { data, error } = await supabase.rpc('crm_client_search', { q });
      console.log('CLIENT SEARCH:', q, '->', Array.isArray(data) ? data.length + ' results' : data, error ? ('ERROR: ' + JSON.stringify(error)) : 'no error');
      if (error) console.error('client search error:', error);
      setResults(data || []);"""
if s.count(old) != 1: print(f"ABORTED: anchor x{s.count(old)}"); sys.exit(1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s.replace(old, new, 1))
print("ClientFile: loud search diagnostic in")
