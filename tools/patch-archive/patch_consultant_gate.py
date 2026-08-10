import sys
f = 'src/pages/ConsultantBonus.jsx'
s = open(f, encoding='utf-8', errors='surrogateescape').read()

old = "  const { currentUser, users } = useApp();\n  "
# both pages share this line - scope to ConsultantBonus by pairing with its next unique line
old = "export default function ConsultantBonus() {\n  const { currentUser, users } = useApp();"
new = """export default function ConsultantBonus() {
  const { currentUser, users } = useApp();
  const dailyGate = useDailyGate(currentUser, 'consultant', CONSULTANT_CHECKLIST, currentUser?.department === 'credit_consultants');"""
if s.count(old) != 1: print(f"ABORTED: entry anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)

old = "import { useApp } from '../context/AppContext';"
new = "import { useApp } from '../context/AppContext';\nimport { useDailyGate, CONSULTANT_CHECKLIST } from '../components/DailyChecklistGate';"
if s.count(old) != 1: print(f"ABORTED: import anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)

old = "  if (!data) return null;"
new = """  if (!data) return null;
  if (!dailyGate.ready) return <div className="p-6 text-center text-slate-500">Loading\u2026</div>;
  if (!dailyGate.unlocked) return dailyGate.panel;"""
if s.count(old) != 1: print(f"ABORTED: return anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
print("ConsultantBonus: daily gate wired (consultant checklist, credit_consultants only)")
