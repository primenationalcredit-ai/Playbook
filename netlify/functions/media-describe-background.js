// netlify/functions/media-describe-background.js
//
// MEDIA LIBRARY - AI auto-describe (Joe 8/13, project card 1d5cd505).
// Fired after Add Video (fire-and-forget). Sweeps media_items rows with no
// ai_summary yet (newest first, 10 max/run) and writes a 2-3 sentence summary
// plus search keywords from the metadata we have (title, description, folder,
// categories). NOTE: works from metadata - it does not watch the video.
// Netlify -background convention: returns 202 immediately, keeps working.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;
const SB = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };

exports.handler = async () => {
  try {
    if (!SUPABASE_URL || !SERVICE_KEY || !ANTHROPIC_KEY) { console.error('media-describe: missing env'); return { statusCode: 200 }; }
    const rows = await fetch(`${SUPABASE_URL}/rest/v1/media_items?ai_summary=is.null&select=id,title,description,categories,folder_id,kind,url&order=created_at.desc&limit=10`, { headers: SB }).then(r => r.json());
    if (!Array.isArray(rows) || rows.length === 0) return { statusCode: 200 };
    const folders = await fetch(`${SUPABASE_URL}/rest/v1/media_folders?select=id,name`, { headers: SB }).then(r => r.json()).catch(() => []);
    const fname = (id) => ((folders || []).find(f => f.id === id) || {}).name || '';
    for (const it of rows) {
      try {
        const prompt = `You write short catalog descriptions for an internal training video library at a credit repair company. From the metadata below, write JSON with two fields: "summary" (2-3 plain sentences describing what an employee will likely learn or see - confident but never inventing specifics that are not implied by the metadata) and "keywords" (8-12 comma-separated search terms employees might type, including synonyms). Respond with ONLY the JSON object.\n\nTitle: ${it.title}\nDescription: ${it.description || '(none)'}\nFolder: ${fname(it.folder_id) || '(none)'}\nCategories: ${(it.categories || []).join(', ') || '(none)'}\nSource type: ${it.kind}`;
        const r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 500, messages: [{ role: 'user', content: prompt }] })
        });
        if (!r.ok) { console.error('anthropic', r.status, 'item', it.id); continue; }
        const txt = ((await r.json()).content || []).map(c => c.text || '').join('');
        let parsed = null;
        try { parsed = JSON.parse(txt.replace(/^[^{]*/, '').replace(/[^}]*$/, '')); } catch (e) {}
        if (!parsed || !parsed.summary) { console.error('unparseable summary for', it.id); continue; }
        const summary = String(parsed.summary).slice(0, 600) + (parsed.keywords ? ('\n\nKeywords: ' + String(parsed.keywords).slice(0, 300)) : '');
        await fetch(`${SUPABASE_URL}/rest/v1/media_items?id=eq.${it.id}`, {
          method: 'PATCH', headers: { ...SB, Prefer: 'return=minimal' },
          body: JSON.stringify({ ai_summary: summary })
        });
        console.log('described', it.id, it.title);
      } catch (e) { console.error('describe failed for', it.id, e.message); }
    }
    return { statusCode: 200 };
  } catch (err) { console.error('media-describe error:', err.message); return { statusCode: 200 }; }
};
