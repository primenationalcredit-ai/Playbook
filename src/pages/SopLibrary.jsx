import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { BookOpen, Search, FileText, Loader2, Sparkles, Send } from 'lucide-react';
import { supabase } from '../lib/supabase';
import SopDocument from '../components/SopDocument';

// PHASE E of the AI Project Manager (Joe 8/13): the searchable SOP library.
// Joe's stated pain is employees signing off on training and then asking the same
// question six months later. Every SOP approved through the AI Project Manager is
// stored on its project card; this page is the one place to find and read them all.
// Visible to EVERYONE - that is the point. Reading a process is never restricted.
export default function SopLibrary() {
  const { supabaseFetch } = useApp();
  const [sops, setSops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  // ASK THE PLAYBOOK (Phase E): answers strictly from the approved SOPs above.
  const [ask, setAsk] = useState('');
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState(null);
  const askPlaybook = async () => {
    const question = ask.trim();
    if (!question || asking) return;
    setAsking(true); setAnswer(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess && sess.session && sess.session.access_token;
      const hdr = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token };
      const r = await fetch('/.netlify/functions/ask-playbook', { method: 'POST', headers: hdr, body: JSON.stringify({ action: 'ask', question }) });
      const j = await r.json();
      if (!r.ok || !j.nonce) throw new Error(j.error || 'could not ask');
      for (let t = 0; t < 60; t++) {
        await new Promise(res => setTimeout(res, 2000));
        const pr = await fetch('/.netlify/functions/ask-playbook', { method: 'POST', headers: hdr, body: JSON.stringify({ action: 'status', nonce: j.nonce }) });
        const pj = await pr.json();
        if (pj.status === 'done') { setAnswer(pj.answer); setAsking(false); return; }
        if (pj.status === 'error') throw new Error(pj.error || 'failed');
      }
      throw new Error('timed out');
    } catch (e) { setAnswer('Could not answer: ' + e.message); setAsking(false); }
  };

  useEffect(() => {
    (async () => {
      const cards = await supabaseFetch('project_cards', 'select=id,title,links,updated_at&order=updated_at.desc');
      const all = [];
      (cards || []).forEach(c => {
        (Array.isArray(c.links) ? c.links : []).forEach(l => {
          if (l && l.sop && l.content) all.push({ ...l, projectTitle: c.title, projectId: c.id });
        });
      });
      all.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
      setSops(all); setLoading(false);
    })();
  }, []);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return sops;
    return sops.filter(s =>
      String(s.projectTitle || '').toLowerCase().includes(t) ||
      String(s.label || '').toLowerCase().includes(t) ||
      String(s.content || '').toLowerCase().includes(t)
    );
  }, [q, sops]);

  const snippet = (s) => {
    const t = q.trim().toLowerCase();
    const body = String(s.content || '').replace(/[#*`>|-]/g, ' ').replace(/\s+/g, ' ');
    if (!t) return body.slice(0, 180);
    const i = body.toLowerCase().indexOf(t);
    if (i < 0) return body.slice(0, 180);
    return (i > 40 ? '...' : '') + body.slice(Math.max(0, i - 40), Math.max(0, i - 40) + 200);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {open && <SopDocument sop={open} projectTitle={open.projectTitle} onClose={() => setOpen(null)} />}
      <div className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 rounded-xl bg-asap-blue/10 flex items-center justify-center"><BookOpen className="w-5 h-5 text-asap-blue" /></div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">SOP Library</h1>
          <p className="text-sm text-slate-500">Every approved process, searchable. Look here before asking.</p>
        </div>
      </div>
      <div className="mt-5 rounded-2xl border border-violet-200 bg-violet-50/50 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-violet-600" />
          <div className="text-sm font-semibold text-slate-800">Ask the Playbook</div>
          <div className="text-xs text-slate-500">answers only from approved SOPs</div>
        </div>
        <div className="flex gap-2">
          <input value={ask} onChange={e => setAsk(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') askPlaybook(); }}
            placeholder="How do I ... ?" className="flex-1 px-3 py-2 border border-violet-200 rounded-xl text-sm bg-white focus:outline-none focus:border-violet-500" />
          <button onClick={askPlaybook} disabled={asking} className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 flex items-center gap-1.5">
            {asking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}{asking ? 'Reading SOPs' : 'Ask'}
          </button>
        </div>
        {answer && <div className="mt-3 bg-white border border-violet-200 rounded-xl p-4 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{answer}</div>}
      </div>
      <div className="relative my-5">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search every SOP - try a feature, a button name, or a question"
          className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-asap-blue" />
      </div>
      {loading && <div className="flex items-center gap-2 text-slate-400 text-sm p-6"><Loader2 className="w-4 h-4 animate-spin" /> Loading SOPs...</div>}
      {!loading && sops.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <div className="text-sm">No SOPs have been approved yet.</div>
          <div className="text-xs mt-1">They appear here automatically once leadership approves one on a project.</div>
        </div>
      )}
      {!loading && sops.length > 0 && shown.length === 0 && <div className="text-sm text-slate-400 p-6">Nothing matches that search.</div>}
      <div className="space-y-2">
        {shown.map((s, i) => (
          <button key={i} onClick={() => setOpen(s)} className="w-full text-left bg-white border border-slate-200 rounded-xl px-5 py-4 hover:border-asap-blue hover:shadow-sm transition">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-asap-blue shrink-0" />
              <div className="font-semibold text-slate-800 truncate">{s.projectTitle}</div>
              <div className="text-xs text-slate-400 shrink-0">{s.label}</div>
            </div>
            <div className="text-xs text-slate-500 mt-1.5 line-clamp-2">{snippet(s)}</div>
            <div className="text-[11px] text-slate-400 mt-1.5">{s.approved_by ? 'Approved by ' + s.approved_by : ''}{s.at ? ' - ' + new Date(s.at).toLocaleDateString() : ''}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
