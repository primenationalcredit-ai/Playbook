// PHASE E part 3 (Joe 8/13): 90-day training refreshers.
// Joe's pain: employees sign off on training and ask the same question six months
// later. Ninety days after someone COMPLETES a course, they get it assigned again.
//
// NO NEW TABLES AND NO MIGRATION - a refresher is just a new training_assignments
// row for the same course, so it flows through the training UI, stamps completed_at
// the same way, and is enforced by the Phase D lockout automatically.
// A refresher is IDENTIFIED, not flagged: the user has an older completed assignment
// for that course. That is why no schema change was needed.
//
// GUARDS: only published courses; never assign if an OPEN assignment already exists
// for that user+course; leadership/admin skipped (never locked out, so never chased);
// 14-day grace due date so nobody is locked out the morning it fires.
async function runRefresherSweep(SU, H, { dryRun }) {
  const DAYS = 90, GRACE = 14;
  const cutoff = new Date(Date.now() - DAYS * 86400000).toISOString();
  const asg = await fetch(`${SU}/rest/v1/training_assignments?select=id,user_id,course_id,due_date,completed_at&order=completed_at.desc`, { headers: H }).then(r => r.json());
  const courses = await fetch(`${SU}/rest/v1/training_courses?select=id,title,is_published`, { headers: H }).then(r => r.json());
  const users = await fetch(`${SU}/rest/v1/users?select=id,name,department,role`, { headers: H }).then(r => r.json());
  if (!Array.isArray(asg) || !Array.isArray(courses) || !Array.isArray(users)) return { error: 'could not read tables' };
  const pub = {}; courses.forEach(c => { if (c.is_published) pub[c.id] = c.title; });
  const person = {}; users.forEach(u => { person[u.id] = u; });
  const byPair = {};
  asg.forEach(a => {
    const k = a.user_id + '|' + a.course_id;
    (byPair[k] = byPair[k] || []).push(a);
  });
  const due = [];
  Object.keys(byPair).forEach(k => {
    const [userId, courseId] = k.split('|');
    if (!pub[courseId]) return;
    const u = person[userId];
    if (!u) return;
    if (u.department === 'leadership' || u.role === 'admin') return;
    const rows = byPair[k];
    if (rows.some(r => !r.completed_at)) return;
    let latest = null;
    rows.forEach(r => { if (r.completed_at && (!latest || r.completed_at > latest)) latest = r.completed_at; });
    if (!latest || latest > cutoff) return;
    due.push({ user_id: userId, course_id: courseId, name: u.name, course: pub[courseId], last_completed: latest });
  });
  if (dryRun) return { dry_run: true, would_assign: due.length, detail: due.slice(0, 50) };
  let created = 0;
  for (const d of due) {
    const dd = new Date(); dd.setDate(dd.getDate() + GRACE);
    const r = await fetch(`${SU}/rest/v1/training_assignments`, { method: 'POST', headers: { ...H, Prefer: 'return=minimal' },
      body: JSON.stringify({ user_id: d.user_id, course_id: d.course_id, due_date: dd.toISOString() }) });
    if (r.ok) created++;
  }
  return { assigned: created, considered: due.length, detail: due.slice(0, 50) };
}

const SU = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SK = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const KEY = process.env.PAYMENT_API_KEY || process.env.PIPEDRIVE_API_KEY || '';
const H = { apikey: SK, Authorization: `Bearer ${SK}`, 'Content-Type': 'application/json' };
exports.handler = async (event) => {
  const given = (event.queryStringParameters && event.queryStringParameters.key) || event.headers['x-api-key'] || '';
  if (!KEY || given !== KEY) return { statusCode: 401, body: 'no' };
  const dryRun = String((event.queryStringParameters || {}).dry_run || '') === '1';
  try {
    const out = await runRefresherSweep(SU, H, { dryRun });
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(out, null, 2) };
  } catch (e) { return { statusCode: 500, body: e.message }; }
};
