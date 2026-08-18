import sys
f = "src/pages/AMBonus.jsx"
s = open(f, encoding="utf-8", errors="surrogateescape").read()

a = """  const myResponses = (surveyResponses || []).filter(r => {
    const key = (r.am_name || '').toLowerCase();
    const nm = (currentAMName || '').toLowerCase();
    if (!key || !nm || nm === 'unknown') return false;
    return key.includes(nm.split(' ')[0]) || nm.includes(key.split(' ')[0]);
  });"""
if s.count(a) != 1:
    print("ABORTED: anchor x" + str(s.count(a)))
    sys.exit(1)

b = """  const myResponses = (surveyResponses || []).filter(r => {
    const key = (r.am_name || '').toLowerCase();
    const nm = (currentAMName || '').toLowerCase();
    if (!key || !nm || nm === 'unknown') return false;
    if (!(key.includes(nm.split(' ')[0]) || nm.includes(key.split(' ')[0]))) return false;
    // Month scope (Kim 8/17, CSAT tracker showing July responses under August):
    // this raw response list had no date boundary at all - selecting August
    // showed every response ever received, from every month. Match the same
    // calendar-month window am-csat.js already correctly uses for the average.
    if (!r.created_at) return false;
    return String(r.created_at).slice(0, 7) === selectedMonth;
  });"""
s = s.replace(a, b, 1)
open(f, "w", encoding="utf-8", errors="surrogateescape", newline="").write(s)
print("month scope added to myResponses")
