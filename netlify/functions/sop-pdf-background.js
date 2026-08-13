// netlify/functions/sop-pdf-background.js
//
// SOP -> PDF (Joe 8/13): every approved SOP gets a real PDF stored in the app.
// Sweep-style: any SOP link on project_cards without a pdf_url gets rendered
// (zero-dependency PDF writer, built-in Helvetica - nothing to bundle, nothing
// esbuild can break), uploaded to the sop-pdfs bucket, and the link stamped
// with pdf_url. Fired from SopLibrary on load (fire-and-forget), so new SOPs
// get their PDF automatically and old ones backfill on first visit.
const SU = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SK = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: SK, Authorization: `Bearer ${SK}`, 'Content-Type': 'application/json' };

function sanitizeTxt(t) {
  return String(t || '')
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2022\u25CF\u25AA]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[^\x20-\x7E\n]/g, ' ');
}
function escPdf(t) { return t.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)'); }
function wrapTxt(t, max) {
  const out = []; let line = '';
  for (const w of String(t).split(/\s+/)) {
    if (!w) continue;
    if ((line + ' ' + w).trim().length > max) { if (line) out.push(line); line = w; }
    else line = (line ? line + ' ' : '') + w;
  }
  if (line) out.push(line);
  return out.length ? out : [''];
}
function buildSopPdf(projectTitle, link, md) {
  const items = [];
  const push = (t, s, b, ind, gap) => {
    if (gap) items.push({ t: '', s: 6, b: false, ind: 0 });
    const max = Math.max(20, Math.floor(500 / (s * 0.52)));
    for (const w of wrapTxt(t, max)) items.push({ t: w, s, b, ind: ind || 0 });
  };
  push('ASAP CREDIT REPAIR - STANDARD OPERATING PROCEDURE', 9, true, 0);
  push(sanitizeTxt(projectTitle), 17, true, 0, true);
  const meta = [link.label, link.approved_by ? 'Approved by ' + link.approved_by : '', link.at ? new Date(link.at).toLocaleDateString('en-US') : ''].filter(Boolean).join('   |   ');
  if (meta) push(sanitizeTxt(meta), 9, false, 0);
  items.push({ t: '', s: 10, b: false, ind: 0 });
  for (const raw of sanitizeTxt(md).split('\n')) {
    const l = raw.replace(/\*\*/g, '').replace(/`/g, '').replace(/^>\s?/, '');
    if (/^#\s+/.test(l)) push(l.replace(/^#\s+/, ''), 15, true, 0, true);
    else if (/^##\s+/.test(l)) push(l.replace(/^##\s+/, ''), 12.5, true, 0, true);
    else if (/^###+\s+/.test(l)) push(l.replace(/^###+\s+/, ''), 11, true, 0, true);
    else if (/^\s*[-*]\s+/.test(l)) push('- ' + l.replace(/^\s*[-*]\s+/, ''), 10, false, 14);
    else if (/^\s*\d+\.\s+/.test(l)) push(l.trim(), 10, false, 14);
    else if (!l.trim()) items.push({ t: '', s: 5, b: false, ind: 0 });
    else push(l.trim(), 10, false, 0);
  }
  const pages = []; let cur = []; let y = 742;
  for (const it of items) {
    const lh = it.s * 1.45;
    if (y - lh < 55) { pages.push(cur); cur = []; y = 742; }
    if (it.t) cur.push({ t: it.t, s: it.s, b: it.b, ind: it.ind, y: y - lh });
    y -= lh;
  }
  if (cur.length) pages.push(cur);
  if (!pages.length) pages.push([{ t: '(empty SOP)', s: 10, b: false, ind: 0, y: 700 }]);
  const nPages = pages.length;
  const kids = pages.map((_, i) => `${5 + i * 2} 0 R`).join(' ');
  const objBodies = [];
  objBodies[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objBodies[2] = `<< /Type /Pages /Kids [${kids}] /Count ${nPages} >>`;
  objBodies[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  objBodies[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';
  pages.forEach((pg, i) => {
    const pn = 5 + i * 2, cn = 6 + i * 2;
    objBodies[pn] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${cn} 0 R >>`;
    const stream = pg.map(it => `BT /${it.b ? 'F2' : 'F1'} ${it.s} Tf ${50 + (it.ind || 0)} ${it.y.toFixed(1)} Td (${escPdf(it.t)}) Tj ET`).join('\n');
    objBodies[cn] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });
  let out = '%PDF-1.4\n';
  const offsets = [0];
  for (let n = 1; n < objBodies.length; n++) {
    offsets[n] = out.length;
    out += `${n} 0 obj\n${objBodies[n]}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${objBodies.length}\n0000000000 65535 f \n`;
  for (let n = 1; n < objBodies.length; n++) out += String(offsets[n]).padStart(10, '0') + ' 00000 n \n';
  out += `trailer\n<< /Size ${objBodies.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return out;
}

exports.handler = async () => {
  try {
    if (!SU || !SK) { console.error('sop-pdf: missing env'); return { statusCode: 200, body: '{}' }; }
    const cards = await fetch(`${SU}/rest/v1/project_cards?select=id,title,links&links=not.is.null`, { headers: H }).then(r => r.json());
    let made = 0; const errs = [];
    for (const c of (Array.isArray(cards) ? cards : [])) {
      if (!Array.isArray(c.links)) continue;
      let changed = false;
      for (const l of c.links) {
        if (!l || !l.sop || !l.content || l.pdf_url) continue;
        try {
          const pdf = buildSopPdf(c.title, l, l.content);
          const fname = `sop-${c.id}-${String(l.label || 'v1').replace(/[^a-zA-Z0-9._-]/g, '_')}.pdf`;
          const up = await fetch(`${SU}/storage/v1/object/sop-pdfs/${fname}`, {
            method: 'POST',
            headers: { apikey: SK, Authorization: `Bearer ${SK}`, 'Content-Type': 'application/pdf', 'x-upsert': 'true' },
            body: Buffer.from(pdf, 'binary')
          });
          if (!up.ok) { errs.push(fname + ' upload ' + up.status); continue; }
          l.pdf_url = `${SU}/storage/v1/object/public/sop-pdfs/${fname}`;
          changed = true; made++;
        } catch (e) { errs.push((l.label || '?') + ': ' + e.message); }
      }
      if (changed) {
        await fetch(`${SU}/rest/v1/project_cards?id=eq.${c.id}`, {
          method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' },
          body: JSON.stringify({ links: c.links, updated_at: new Date().toISOString() })
        });
      }
    }
    console.log('sop-pdf: generated', made, 'errors', errs.length ? errs : 'none');
    return { statusCode: 200, body: JSON.stringify({ generated: made, errors: errs }) };
  } catch (err) { console.error('sop-pdf error:', err.message); return { statusCode: 200, body: JSON.stringify({ error: err.message }) }; }
};
