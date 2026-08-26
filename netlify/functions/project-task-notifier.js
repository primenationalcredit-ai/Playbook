// netlify/functions/project-task-notifier.js
// Daily project task notifier (Joe 8/26): every morning, each project task
// assignee gets ONE email of their overdue + due-today tasks; management@ gets
// one cross-project digest (only when something is overdue). Cards on hold skipped.
// Manual twin + dry_run for preview. Sends via SendGrid.
const SU = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SK = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const H = { apikey: SK, Authorization: `Bearer ${SK}` };
const ALERT_TO = 'management@asapcreditrepairusa.com';
const PLAYBOOK_URL = 'https://cute-cat-d9631c.netlify.app/leadership-projects';
const NON_HUMANS = ['claude', 'ai', 'leadership', 'team', 'tbd', 'everyone'];

function matchUser(assignee, users) {
  const parts = String(assignee || '').toLowerCase().split(/[+/&,]|\band\b/).map(s => s.trim()).filter(Boolean);
  for (const part of parts) {
    if (!part || NON_HUMANS.includes(part)) continue;
    const hit = users.find(u => {
      const n = String(u.name || '').toLowerCase();
      return n === part || n.startsWith(part + ' ') || n.split(' ')[0] === part || part.startsWith(n) || n.startsWith(part);
    });
    if (hit) return hit;
  }
  return null;
}

async function sendMail(to, subject, text) {
  return fetch('https://api.sendgrid.com/v3/mail/send', { method: 'POST', headers: { Authorization: `Bearer ${SENDGRID_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ personalizations: [{ to: [{ email: to }] }], from: { email: 'info@asapcreditrepairusa.com', name: 'ASAP Project Manager' }, subject, content: [{ type: 'text/plain', value: text }] }) });
}

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };
  let dryRun = false;
  if (event.httpMethod === 'POST') {
    try { dryRun = JSON.parse(event.body || '{}').dry_run === true; } catch (e) {}
    if ((event.queryStringParameters || {}).dry_run === '1') dryRun = true;
  }
  const report = { ranAt: new Date().toISOString(), dryRun, emails: [], digest_lines: [], unmatched: [], errors: [] };
  try {
    const today = new Date().toISOString().slice(0, 10);
    const cards = await fetch(`${SU}/rest/v1/project_cards?select=id,title,steps,on_hold_reason&order=created_at.asc`, { headers: H }).then(r => r.json());
    const users = await fetch(`${SU}/rest/v1/users?select=id,name,email,is_active&is_active=eq.true`, { headers: H }).then(r => r.json());
    if (!Array.isArray(cards) || !Array.isArray(users)) return done({ error: 'could not read tables' });
    const byPerson = {};
    for (const card of cards) {
      if (card.on_hold_reason) continue;
      for (const st of (card.steps || [])) {
        if (st.done || !st.due) continue;
        if (String(st.due) > today) continue;
        const days = Math.round((new Date(today) - new Date(st.due)) / 86400000);
        const item = { project: card.title, task: String(st.text || '').slice(0, 120), due: st.due, days_late: days, assignee: st.assignee || '(unassigned)' };
        report.digest_lines.push(item);
        const u = matchUser(st.assignee, users);
        if (u && u.email) { (byPerson[u.email] = byPerson[u.email] || { name: u.name, items: [] }).items.push(item); }
        else { report.unmatched.push(item); }
      }
    }
    for (const [email, p] of Object.entries(byPerson)) {
      const overdue = p.items.filter(i => i.days_late > 0), dueToday = p.items.filter(i => i.days_late === 0);
      const lines = [`Hi ${p.name.split(' ')[0]},`, ''];
      if (overdue.length) { lines.push(`OVERDUE (${overdue.length}):`); overdue.forEach(i => lines.push(`- [${i.project}] ${i.task} - due ${i.due} (${i.days_late} day${i.days_late === 1 ? '' : 's'} late)`)); lines.push(''); }
      if (dueToday.length) { lines.push(`DUE TODAY (${dueToday.length}):`); dueToday.forEach(i => lines.push(`- [${i.project}] ${i.task}`)); lines.push(''); }
      lines.push(`Open your projects: ${PLAYBOOK_URL}`);
      const subject = overdue.length ? `You have ${overdue.length} overdue project task${overdue.length === 1 ? '' : 's'}` : `You have ${dueToday.length} project task${dueToday.length === 1 ? '' : 's'} due today`;
      if (dryRun) { report.emails.push({ to: email, subject, count: p.items.length }); continue; }
      try { const r = await sendMail(email, subject, lines.join('\n')); report.emails.push({ to: email, subject, status: r.status }); }
      catch (e) { report.errors.push({ to: email, error: e.message }); }
    }
    const anyOverdue = report.digest_lines.some(i => i.days_late > 0);
    if (anyOverdue) {
      const dl = [`Project task status for ${today}:`, ''];
      const byProj = {};
      report.digest_lines.forEach(i => { (byProj[i.project] = byProj[i.project] || []).push(i); });
      for (const [proj, items] of Object.entries(byProj)) {
        dl.push(proj + ':');
        items.forEach(i => dl.push(`  - ${i.task} | ${i.assignee} | due ${i.due}${i.days_late > 0 ? ' | ' + i.days_late + 'd LATE' : ' | due today'}`));
        dl.push('');
      }
      if (report.unmatched.length) { dl.push('No email match (showing here only): ' + report.unmatched.map(i => i.assignee).filter((v, x, a) => a.indexOf(v) === x).join(', ')); }
      if (!dryRun) { try { const r = await sendMail(ALERT_TO, `Project tasks: ${report.digest_lines.filter(i => i.days_late > 0).length} overdue across ${Object.keys(byProj).length} project(s)`, dl.join('\n')); report.digest_sent = r.status; } catch (e) { report.errors.push({ digest: e.message }); } }
      else { report.digest_would_send = true; }
    }
  } catch (e) { report.errors.push({ fatal: e.message }); }
  return done(report);
  function done(r) { return { statusCode: 200, headers, body: JSON.stringify(r) }; }
};
