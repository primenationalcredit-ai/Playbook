import React, { useMemo } from 'react';
import { X, Printer, Copy, FileText } from 'lucide-react';

// SOP DOCUMENT VIEWER (Joe 8/13): approved SOPs were stored as markdown and shown
// in a raw <pre>, which nobody wants to read. This renders them as an actual
// typeset document - and prints clean, so an SOP can go on paper or to PDF.
// Self-contained markdown subset so no new dependency enters the build.

function inline(t, k) {
  const out = []; let buf = ''; let i = 0; let n = 0;
  const push = (el) => { if (buf) { out.push(buf); buf = ''; } out.push(el); };
  while (i < t.length) {
    if (t.startsWith('**', i)) {
      const e = t.indexOf('**', i + 2);
      if (e > -1) { push(<strong key={k + '-b' + n++} className="font-semibold text-slate-900">{t.slice(i + 2, e)}</strong>); i = e + 2; continue; }
    }
    if (t[i] === '`') {
      const e = t.indexOf('`', i + 1);
      if (e > -1) { push(<code key={k + '-c' + n++} className="px-1.5 py-0.5 rounded bg-slate-100 text-[0.85em] font-mono text-slate-800">{t.slice(i + 1, e)}</code>); i = e + 1; continue; }
    }
    if (t[i] === '*' && t[i + 1] !== '*') {
      const e = t.indexOf('*', i + 1);
      if (e > -1) { push(<em key={k + '-i' + n++}>{t.slice(i + 1, e)}</em>); i = e + 1; continue; }
    }
    buf += t[i]; i++;
  }
  if (buf) out.push(buf);
  return out;
}

function render(md) {
  const lines = String(md || '').replace(/\r/g, '').split('\n');
  const els = []; let i = 0; let key = 0;
  const flushList = (items, ordered) => {
    const Tag = ordered ? 'ol' : 'ul';
    els.push(
      <Tag key={'l' + key++} className={(ordered ? 'list-decimal' : 'list-disc') + ' pl-6 my-3 space-y-1.5 text-slate-700'}>
        {items.map((it, j) => <li key={j} className="leading-relaxed pl-1">{inline(it, 'li' + key + j)}</li>)}
      </Tag>
    );
  };
  while (i < lines.length) {
    const raw = lines[i]; const line = raw.trim();
    if (!line) { i++; continue; }
    if (/^---+$/.test(line) || /^\*\*\*+$/.test(line)) { els.push(<hr key={'h' + key++} className="my-8 border-slate-200" />); i++; continue; }
    if (line.startsWith('#')) {
      const m = line.match(/^(#+)\s*(.*)$/); const lvl = m[1].length; const txt = m[2];
      if (lvl === 1) els.push(<h1 key={'t' + key++} className="text-3xl font-bold text-slate-900 mb-2 leading-tight">{inline(txt, 't' + key)}</h1>);
      else if (lvl === 2) els.push(<h2 key={'t' + key++} className="text-xl font-bold text-slate-900 mt-10 mb-3 pb-2 border-b-2 border-asap-blue/20">{inline(txt, 't' + key)}</h2>);
      else if (lvl === 3) els.push(<h3 key={'t' + key++} className="text-base font-bold text-asap-blue mt-7 mb-2 uppercase tracking-wide">{inline(txt, 't' + key)}</h3>);
      else els.push(<h4 key={'t' + key++} className="text-sm font-semibold text-slate-800 mt-5 mb-1">{inline(txt, 't' + key)}</h4>);
      i++; continue;
    }
    if (line.startsWith('>')) {
      const q = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) { q.push(lines[i].trim().replace(/^>\s?/, '')); i++; }
      els.push(<blockquote key={'q' + key++} className="my-4 pl-4 border-l-4 border-amber-300 bg-amber-50/60 py-2 pr-3 text-slate-700 italic">{inline(q.join(' '), 'q' + key)}</blockquote>);
      continue;
    }
    if (line.startsWith('|') && i + 1 < lines.length && /^\|[\s:|-]+\|$/.test(lines[i + 1].trim())) {
      const cells = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const head = cells(lines[i]); i += 2; const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(cells(lines[i])); i++; }
      els.push(
        <div key={'tb' + key++} className="my-5 overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50"><tr>{head.map((h, j) => <th key={j} className="text-left px-3 py-2 font-semibold text-slate-700 border-b border-slate-200">{inline(h, 'th' + j)}</th>)}</tr></thead>
            <tbody>{rows.map((r, j) => <tr key={j} className="border-b border-slate-100 last:border-0">{r.map((c, k2) => <td key={k2} className="px-3 py-2 align-top text-slate-700">{inline(c, 'td' + j + k2)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      );
      continue;
    }
    if (/^[-*+]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) { items.push(lines[i].trim().replace(/^[-*+]\s+/, '')); i++; }
      flushList(items, false); continue;
    }
    if (/^\d+[.)]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(lines[i].trim().replace(/^\d+[.)]\s+/, ''));
        i++;
        while (i < lines.length && /^\s{2,}[-*+]?\s*\S/.test(lines[i]) && !/^\s*\d+[.)]\s+/.test(lines[i])) {
          items[items.length - 1] += ' ' + lines[i].trim().replace(/^[-*+]\s+/, '');
          i++;
        }
      }
      flushList(items, true); continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^[#>|]/.test(lines[i].trim()) && !/^[-*+]\s/.test(lines[i].trim()) && !/^\d+[.)]\s/.test(lines[i].trim()) && !/^---+$/.test(lines[i].trim())) { para.push(lines[i].trim()); i++; }
    els.push(<p key={'p' + key++} className="my-3 leading-relaxed text-slate-700">{inline(para.join(' '), 'p' + key)}</p>);
  }
  return els;
}

export default function SopDocument({ sop, projectTitle, onClose }) {
  const body = useMemo(() => render(sop?.content), [sop]);
  const when = sop?.at ? new Date(sop.at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '';
  const print = () => {
    const w = window.open('', '_blank', 'width=900,height=1100');
    if (!w) return;
    const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
    w.document.write('<html><head><title>' + esc(sop?.label || 'SOP') + '</title><style>'
      + 'body{font-family:Georgia,serif;max-width:7.5in;margin:0.6in auto;color:#1e293b;line-height:1.6}'
      + 'h1{font-size:24pt;margin:0 0 4pt}h2{font-size:14pt;margin:24pt 0 8pt;padding-bottom:4pt;border-bottom:1.5pt solid #cbd5e1}'
      + 'h3{font-size:11pt;text-transform:uppercase;letter-spacing:.04em;color:#003f87;margin:18pt 0 6pt}'
      + 'table{border-collapse:collapse;width:100%;margin:10pt 0}th,td{border:1px solid #cbd5e1;padding:5pt 7pt;text-align:left;font-size:10pt}'
      + 'th{background:#f1f5f9}li{margin:3pt 0}code{background:#f1f5f9;padding:1pt 3pt}'
      + '.meta{color:#64748b;font-size:9pt;border-bottom:1pt solid #e2e8f0;padding-bottom:8pt;margin-bottom:16pt}'
      + '@page{margin:0.7in}</style></head><body>');
    w.document.write('<div class="meta">' + esc(projectTitle) + ' &middot; ' + esc(sop?.label) + (sop?.approved_by ? ' &middot; approved by ' + esc(sop.approved_by) : '') + (when ? ' &middot; ' + esc(when) : '') + '</div>');
    w.document.write(document.getElementById('sop-print-body').innerHTML);
    w.document.write('</body></html>');
    w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
  };
  return (
    <div className="fixed inset-0 z-[90] bg-slate-900/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col" style={{ height: '92vh' }} onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-asap-blue/10 flex items-center justify-center shrink-0"><FileText className="w-5 h-5 text-asap-blue" /></div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-slate-900 truncate">{sop?.label || 'SOP'}</div>
            <div className="text-xs text-slate-500 truncate">{projectTitle}{sop?.approved_by ? ' - approved by ' + sop.approved_by : ''}{when ? ' - ' + when : ''}</div>
          </div>
          <button onClick={() => navigator.clipboard && navigator.clipboard.writeText(sop?.content || '')} title="Copy markdown" className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"><Copy className="w-4 h-4" /></button>
          <button onClick={print} title="Print or save as PDF" className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"><Printer className="w-4 h-4" /></button>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto bg-slate-100 p-6">
          <div id="sop-print-body" className="mx-auto bg-white rounded-xl shadow-sm border border-slate-200 px-10 py-9" style={{ maxWidth: '46rem' }}>
            {body}
          </div>
        </div>
      </div>
    </div>
  );
}
