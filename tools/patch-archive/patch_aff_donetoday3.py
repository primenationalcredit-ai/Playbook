import sys
f = 'src/pages/AffiliateOutreach.jsx'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
reps = [
    ("""  const [callTasks, setCallTasks] = useState([]);""",
     """  const [callTasks, setCallTasks] = useState([]);
  const [doneToday, setDoneToday] = useState(0);"""),
    ("""    const qd = await sbGet('affiliate_call_tasks?status=eq.queued&select=id,assigned_to&limit=1000');
    setQueuedCount(mine(Array.isArray(qd) ? qd : []).length);""",
     """    const qd = await sbGet('affiliate_call_tasks?status=eq.queued&select=id,assigned_to&limit=1000');
    setQueuedCount(mine(Array.isArray(qd) ? qd : []).length);
    // done-today counter (daily-batch queue: 20/weekday, done means done - Cindy's 8/10 ticket)
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    const dn = await sbGet(`affiliate_call_tasks?status=not.in.(open,queued)&completed_at=gte.${dayStart.toISOString()}&select=id,assigned_to&limit=500`);
    setDoneToday(mine(Array.isArray(dn) ? dn : []).length);"""),
    ("""Completed</button>""",
     """Completed</button>
              {doneToday > 0 && (
                <span className="text-xs text-green-700 bg-green-100 px-3 py-1.5 rounded-lg font-medium">{'\\u2713'} {doneToday} done today{callView === 'open' && callTasks.length === 0 ? ' - finished for the day!' : ''}</span>
              )}"""),
    ("""Waiting in the background. New tasks surface as you complete open ones (max 20 active).""",
     """Waiting for upcoming days. Your next batch of 20 loads each weekday morning."""),
    ("""+{queuedCount} queued""",
     """+{queuedCount} waiting for upcoming days""")
]
for a, b in reps:
    if s.count(a) != 1: print(f"ABORTED: anchor x{s.count(a)}: {a[:60]!r}"); sys.exit(1)
    s = s.replace(a, b, 1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
print("AffiliateOutreach: done-today chip + daily-batch wording in (5 replacements)")
