import sys
f = 'src/pages/Reviews.jsx'
s = open(f, encoding='utf-8').read()
old = "        location_name: formData.location_name || null,"
new = """        // Trustpilot/BBB etc. have no Google location - store the platform name
        // instead of null (the DB requires a value, and this gives the filters
        // a useful bucket per platform). Google reviews keep their listing name.
        location_name: formData.location_name || (formData.platform ? formData.platform.charAt(0).toUpperCase() + formData.platform.slice(1) : 'Other'),"""
if s.count(old) != 1: print(f"ABORTED: save anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', newline='').write(s)
print("non-Google reviews save the platform name as location - no more null constraint error")
