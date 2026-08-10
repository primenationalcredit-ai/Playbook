import sys
f = 'src/pages/ConsultantPayments.jsx'
s = open(f, encoding='utf-8', errors='surrogateescape').read()

old = """      // Process consultants
      const consultants = processConsultants(mtdData, ytdData);
      setConsultantData(consultants);"""
new = """      // Process consultants
      let consultants = processConsultants(mtdData, ytdData);
      // ROSTER FILTER (Joe 8/7): payment rows carry every name Zoho has ever
      // seen (departed consultants, variants) - the ticket showed 13 rows for a
      // 4-person team. Keep only names matching CURRENT consultant-department
      // users in Playbook, so the table mirrors the real roster and adjusts
      // itself on hires/departures. Fail-open: if the roster can't load, show all.
      try {
        const ur = await fetch(`${SUPABASE_URL}/rest/v1/users?department=eq.credit_consultants&select=name,pipedrive_name`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
        const roster = await ur.json();
        if (Array.isArray(roster) && roster.length) {
          const norm = (x) => String(x || '').toLowerCase().replace(/\\s+/g, ' ').trim();
          const rosterNames = roster.flatMap(u => [norm(u.name), norm(u.pipedrive_name)]).filter(Boolean);
          const onRoster = (n) => { const nn = norm(n); return rosterNames.some(r => r === nn || r.includes(nn) || nn.includes(r)); };
          consultants = consultants.filter(c => onRoster(c.name));
        }
      } catch (e) { console.error('roster filter failed - showing all names:', e); }
      setConsultantData(consultants);"""
if s.count(old) != 1: print(f"ABORTED: anchor x{s.count(old)}"); sys.exit(1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s.replace(old, new, 1))
print("ConsultantPayments: performance table filtered to the current consultant roster")
