import sys
f = 'netlify/functions/crm-sync.js'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
old = """    return respond(200, out);
  } catch (e) { return respond(500, { error: e.message, ...out }); }"""
new = """    if (mode === 'notes' || mode === 'all') {
      let nStart = (mode === 'notes') ? (parseInt(q.start) || 0) : 0;
      const cursor = full ? null : (await getState('notes_cursor'));
      let synced = 0, more = true, hitCursor = false, maxSeen = cursor || '';
      for (let p = 0; p < maxPages && more && !hitCursor; p++) {
        const j = await pd(`notes?limit=500&start=${nStart}&sort=update_time DESC`);
        const rows = [];
        for (const n of (j.data || [])) {
          if (cursor && n.update_time <= cursor) { hitCursor = true; break; }
          if (n.update_time > maxSeen) maxSeen = n.update_time;
          rows.push({
            pipedrive_note_id: n.id, pipedrive_deal_id: n.deal_id || null, pipedrive_person_id: n.person_id || null,
            content: n.content || null, pinned: !!n.pinned_to_deal_flag, source: 'pipedrive',
            author: (n.user && n.user.name) || null,
            pd_add_time: n.add_time || null, pd_update_time: n.update_time || null,
            synced_at: new Date().toISOString()
          });
        }
        if (rows.length) { await upsert('crm_notes', rows, 'pipedrive_note_id'); synced += rows.length; }
        const pag = j.additional_data && j.additional_data.pagination;
        more = !!(pag && pag.more_items_in_collection);
        nStart = (pag && pag.next_start) || 0;
      }
      if (maxSeen && (!more || hitCursor)) await setState('notes_cursor', maxSeen);
      out.notes = { synced, done: !more || hitCursor, next_start: (!more || hitCursor) ? null : nStart };
      if (mode === 'notes') return respond(200, out);
    }
    if (mode === 'activities' || mode === 'all') {
      let aStart = (mode === 'activities') ? (parseInt(q.start) || 0) : 0;
      const cursor = full ? null : (await getState('activities_cursor'));
      let synced = 0, more = true, hitCursor = false, maxSeen = cursor || '';
      for (let p = 0; p < maxPages && more && !hitCursor; p++) {
        const j = await pd(`activities?user_id=0&limit=500&start=${aStart}&sort=update_time DESC`);
        const rows = [];
        for (const a of (j.data || [])) {
          if (cursor && a.update_time <= cursor) { hitCursor = true; break; }
          if (a.update_time > maxSeen) maxSeen = a.update_time;
          rows.push({
            pipedrive_activity_id: a.id, pipedrive_deal_id: a.deal_id || null, pipedrive_person_id: a.person_id || null,
            subject: a.subject || null, activity_type: a.type || null, done: !!a.done,
            due_date: a.due_date || null, due_time: a.due_time || null, done_time: a.marked_as_done_time || null,
            note: a.note || null, owner_name: a.owner_name || null, source: 'pipedrive',
            pd_add_time: a.add_time || null, pd_update_time: a.update_time || null,
            synced_at: new Date().toISOString()
          });
        }
        if (rows.length) { await upsert('crm_activities', rows, 'pipedrive_activity_id'); synced += rows.length; }
        const pag = j.additional_data && j.additional_data.pagination;
        more = !!(pag && pag.more_items_in_collection);
        aStart = (pag && pag.next_start) || 0;
      }
      if (maxSeen && (!more || hitCursor)) await setState('activities_cursor', maxSeen);
      out.activities = { synced, done: !more || hitCursor, next_start: (!more || hitCursor) ? null : aStart };
    }
    return respond(200, out);
  } catch (e) { return respond(500, { error: e.message, ...out }); }"""
if s.count(old) != 1: print(f"ABORTED: anchor x{s.count(old)}"); sys.exit(1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s.replace(old, new, 1))
print("crm-sync: notes + activities modes in")
