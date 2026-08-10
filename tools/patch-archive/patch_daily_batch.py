import sys
f = 'netlify/functions/affiliate-cadence-runner.js'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
old = """    // ===== CALL SURFACER (max 20 active per consultant) =====
    // Call tasks are born 'queued'. Promote the OLDEST queued to 'open' until each
    // consultant holds at most 20 open tasks (top-up: finished tasks free slots the
    // next run fills). Runs every invocation; idempotent.
    try {
      const CALL_CAP = parseInt(cfg.affiliate_call_cap_daily || '20', 10) || 20;
      const openRes = await supa(`affiliate_call_tasks?status=eq.open&select=id,assigned_to`);
      const queuedRes = await supa(`affiliate_call_tasks?status=eq.queued&select=id,assigned_to,created_at&order=created_at.asc&limit=1000`);
      const openBy = {};
      for (const t of (openRes.json || [])) { const k = String(t.assigned_to || 'team').toLowerCase(); openBy[k] = (openBy[k] || 0) + 1; }
      const promote = [];
      for (const t of (queuedRes.json || [])) {
        const k = String(t.assigned_to || 'team').toLowerCase();
        if ((openBy[k] || 0) < CALL_CAP) { promote.push(t.id); openBy[k] = (openBy[k] || 0) + 1; }
      }"""
new = """    // ===== CALL SURFACER: DAILY BATCH (Joe 8/10, Cindy's ticket) =====
    // 20 calls per consultant per WEEKDAY. Done means done: completing a call does
    // NOT pull a replacement the same day - each consultant's day counts open +
    // completed-today against the cap, so the morning fill gives (up to) 20 and the
    // list shrinks to zero as they work. Next weekday morning loads the next 20
    // (unfinished calls carry over inside that 20). Weekends: no promotion at all.
    try {
      const CALL_CAP = parseInt(cfg.affiliate_call_cap_daily || '20', 10) || 20;
      const ctNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
      const isWeekday = ctNow.getDay() >= 1 && ctNow.getDay() <= 5;
      const dayStartCT = new Date(ctNow); dayStartCT.setHours(0, 0, 0, 0);
      const dayStartIso = new Date(dayStartCT.getTime() + (Date.now() - ctNow.getTime())).toISOString();
      const openRes = await supa(`affiliate_call_tasks?status=eq.open&select=id,assigned_to`);
      const queuedRes = await supa(`affiliate_call_tasks?status=eq.queued&select=id,assigned_to,created_at&order=created_at.asc&limit=1000`);
      const doneRes = await supa(`affiliate_call_tasks?status=not.in.(open,queued)&completed_at=gte.${dayStartIso}&select=id,assigned_to`);
      const openBy = {};
      for (const t of (openRes.json || [])) { const k = String(t.assigned_to || 'team').toLowerCase(); openBy[k] = (openBy[k] || 0) + 1; }
      for (const t of (doneRes.json || [])) { const k = String(t.assigned_to || 'team').toLowerCase(); openBy[k] = (openBy[k] || 0) + 1; }
      const promote = [];
      for (const t of (isWeekday ? (queuedRes.json || []) : [])) {
        const k = String(t.assigned_to || 'team').toLowerCase();
        if ((openBy[k] || 0) < CALL_CAP) { promote.push(t.id); openBy[k] = (openBy[k] || 0) + 1; }
      }"""
if s.count(old) != 1: print(f"ABORTED: surfacer anchor x{s.count(old)}"); sys.exit(1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s.replace(old, new, 1))
print("cadence runner: daily-batch surfacer in")
