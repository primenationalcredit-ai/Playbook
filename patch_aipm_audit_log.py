import sys
f = 'netlify/functions/ai-project-assistant.js'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
a = "    patch.updates = updates;"
if s.count(a) != 1: print(f"ABORTED: anchor x{s.count(a)}"); sys.exit(1)
b = """    // AUDIT TRAIL (Phase B close, Joe 8/13): the assistant applied edits silently -
    // every applied op batch now posts a one-line summary to Updates automatically,
    // unless the model already posted its own update op this turn.
    const postedOwnUpdate = ops.some(o => o && o.op === 'update');
    if (applied > 0 && !postedOwnUpdate) {
      const summary = ops.filter(o => o && o.op !== 'update').map(o => {
        if (o.op === 'task_set') return `edited task ${o.i + 1}` + (o.fields && o.fields.done === true ? ' (marked done)' : '');
        if (o.op === 'task_add') return 'added a task';
        if (o.op === 'task_remove') return `removed task ${o.i + 1}`;
        if (o.op === 'sub_add') return `added a subtask to task ${o.i + 1}`;
        if (o.op === 'sub_set') return `edited a subtask on task ${o.i + 1}`;
        if (o.op === 'meta') return 'updated project details';
        return o.op;
      }).join('; ');
      updates.unshift({ text: 'Applied: ' + summary.slice(0, 900), by: 'AI Project Manager', at: new Date().toISOString() });
    }
    patch.updates = updates;"""
s = s.replace(a, b, 1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
print("audit trail patched")
