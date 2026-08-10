import sys
f = 'netlify/functions/crm-sync.js'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
old = """  const cur = await getState(k);
  if (!cur || v > cur) await setState(k, v);
}"""
new = """  const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
  if (v > nowStr) v = nowStr; // clamp: a bogus future-dated record (a 2036 activity exists!) must never freeze the cursor
  const cur = await getState(k);
  if (!cur || v > cur) await setState(k, v);
}
async function peekNewest(endpoint, extra) {
  // True newest update_time in PD - used when a multi-call walk finishes on a
  // continuation call (whose own pages are old), so the bookmark lands at the top.
  const j = await pd(`${endpoint}?${extra ? extra + '&' : ''}limit=1&start=0&sort=update_time DESC`);
  const d = (j.data || [])[0];
  return d ? d.update_time : null;
}"""
if s.count(old) != 1: print(f"ABORTED: advanceCursor anchor x{s.count(old)}"); sys.exit(1)
s = s.replace(old, new, 1)
sites = [
    ("if (maxSeen && (!more || hitCursor)) await advanceCursor('persons_cursor', maxSeen);",
     "if (!more || hitCursor) { let cv = maxSeen; if ((parseInt(q.start) || 0) > 0) { try { cv = (await peekNewest('persons')) || cv; } catch (_) {} } if (cv) await advanceCursor('persons_cursor', cv); }"),
    ("if (maxSeen && (!more || hitCursor)) await advanceCursor('deals_cursor', maxSeen);",
     "if (!more || hitCursor) { let cv = maxSeen; if ((parseInt(q.start) || 0) > 0) { try { cv = (await peekNewest('deals')) || cv; } catch (_) {} } if (cv) await advanceCursor('deals_cursor', cv); }"),
    ("if (maxSeen && (!more || hitCursor)) await advanceCursor('notes_cursor', maxSeen);",
     "if (!more || hitCursor) { let cv = maxSeen; if ((parseInt(q.start) || 0) > 0) { try { cv = (await peekNewest('notes')) || cv; } catch (_) {} } if (cv) await advanceCursor('notes_cursor', cv); }"),
    ("if (maxSeen && (!more || hitCursor)) await advanceCursor('activities_cursor', maxSeen);",
     "if (!more || hitCursor) { let cv = maxSeen; if ((parseInt(q.start) || 0) > 0) { try { cv = (await peekNewest('activities', 'user_id=0')) || cv; } catch (_) {} } if (cv) await advanceCursor('activities_cursor', cv); }")
]
for a, b in sites:
    if s.count(a) != 1: print(f"ABORTED: site '{a[:60]}' x{s.count(a)}"); sys.exit(1)
    s = s.replace(a, b, 1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
print("crm-sync: cursor clamp + peek-newest in, 4 sites converted")
