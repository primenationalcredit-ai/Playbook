import sys
f = 'src/pages/AffiliateOutreach.jsx'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
a1 = """  const [callTasks, setCallTasks] = useState([]);"""
if s.count(a1) != 1: print(f"ABORTED: state anchor x{s.count(a1)}"); sys.exit(1)
s = s.replace(a1, a1 + """
  const [doneToday, setDoneToday] = useState(0);""", 1)
a2 = """    const qd = await sbGet('affiliate_call_tasks?status=eq.queued&select=id,assigned_to&limit=1000');
    setQueuedCount(mine(Array.isArray(qd) ? qd : []).length);"""
if s.count(a2) != 1: print(f"ABORTED: loadCalls anchor x{s.count(a2)}"); sys.exit(1)
s = s.replace(a2, a2 + """
    // done-today counter (daily-batch queue: 20/weekday, done means done - Cindy's 8/10 ticket)
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    const dn = await sbGet(`affiliate_call_tasks?status=not.in.(open,queued)&completed_at=gte.${dayStart.toISOString()}&select=id,assigned_to&limit=500`);
    setDoneToday(mine(Array.isArray(dn) ? dn : []).length);""", 1)
a3 = """Completed</button>"""
if s.count(a3) != 1: print(f"ABORTED: Completed-button anchor x{s.count(a3)}"); sys.exit(1)
s = s.replace(a3, a3 + """
              {doneToday > 0 && (
                <span className="text-xs text-green-700 bg-green-100 px-3 py-1.5 rounded-lg font-medium">{'\\u2713'} {doneToday} done today{callView === 'open' && callTasks.length === 0 ? ' - finished for the day!' : ''}</span>
              )}""", 1)
a4 = """title="Waiting in the background. New tasks surface as you complete open ones (max 20 active)."""
if s.count(a4) != 1: print(f"ABORTED: tooltip anchor x{s.count(a4)}"); sys.exit(1)
s = s.replace(a4, """title="Waiting for upcoming days. Your next batch of 20 loads each weekday morning.""", 1)
a5 = """                  +{queuedCount} queued"""
if s.count(a5) != 1: print(f"ABORTED: queued-text anchor x{s.count(a5)}"); sys.exit(1)
s = s.replace(a5, """                  +{queuedCount} waiting for upcoming days""", 1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
print("AffiliateOutreach: done-today chip + daily-batch wording in")
