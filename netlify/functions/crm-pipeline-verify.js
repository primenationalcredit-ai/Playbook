// crm-pipeline-verify.js - the "same number of open deals" proof (Joe 8/10).
// Returns our open-deal counts per pipeline/stage (crm_deals) AND asks
// Pipedrive for its own open total (deals/summary) - the board shows both,
// so mirror-vs-PD is verified on every page load, not on faith.
const PD = process.env.PIPEDRIVE_API_KEY;
const SU = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SK = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: SK, Authorization: `Bearer ${SK}`, 'Content-Type': 'application/json' };
const respond = (c, b) => ({ statusCode: c, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });

exports.handler = async (event) => {
  try {
    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    if (!authHeader.startsWith('Bearer ')) return respond(401, { error: 'no session' });
    const uRes = await fetch(`${SU}/auth/v1/user`, { headers: { apikey: SK, Authorization: authHeader } });
    if (!uRes.ok) return respond(401, { error: 'invalid session' });
    // ours: open counts grouped by pipeline/stage
    const rows = await fetch(`${SU}/rest/v1/rpc/crm_pipeline_counts`, { method: 'POST', headers: H, body: '{}' }).then(r => r.json());
    const ourTotal = (Array.isArray(rows) ? rows : []).reduce((a, r) => a + Number(r.open_count || 0), 0);
    // theirs: PD's own open-deal total
    let pdTotal = null;
    try {
      const sj = await fetch(`https://api.pipedrive.com/v1/deals/summary?status=open&api_token=${PD}`).then(r => r.json());
      pdTotal = (sj && sj.data && (sj.data.total_count ?? sj.data.total_deals_count)) ?? null;
    } catch (_) {}
    return respond(200, { counts: rows, our_total: ourTotal, pd_total: pdTotal, match: pdTotal !== null ? ourTotal === pdTotal : null });
  } catch (e) { return respond(500, { error: e.message }); }
};
