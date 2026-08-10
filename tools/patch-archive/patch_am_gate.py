import sys
f = 'src/pages/AMBonus.jsx'
s = open(f, encoding='utf-8', errors='surrogateescape').read()

old = "export default function AMBonus() {\n  const { currentUser, users } = useApp();"
new = """export default function AMBonus() {
  const { currentUser, users } = useApp();
  const dailyGate = useDailyGate(currentUser, 'account_manager', AM_CHECKLIST, currentUser?.department === 'account_managers');"""
if s.count(old) != 1: print(f"ABORTED: AM entry anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)

old = "import { useApp } from '../context/AppContext';"
new = "import { useApp } from '../context/AppContext';\nimport { useDailyGate, AM_CHECKLIST } from '../components/DailyChecklistGate';"
if s.count(old) != 1: print(f"ABORTED: AM import anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)

old = "  if (loading) return ("
new = """  if (!dailyGate.ready) return <div className="p-6 text-center text-slate-500">Loading\u2026</div>;
  if (!dailyGate.unlocked) return dailyGate.panel;
  if (loading) return ("""
if s.count(old) != 1: print(f"ABORTED: AM loading anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
print("AMBonus: daily gate wired (6-item AM checklist, account_managers only)")
