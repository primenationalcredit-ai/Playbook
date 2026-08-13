import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { Video, Folder, FolderPlus, Plus, Search, Link2, Upload, Trash2, Eye, EyeOff, Loader2, X } from 'lucide-react';

// MEDIA LIBRARY HUB (Joe 8/13) - project card 1d5cd505, AI-created 8/11.
// Phase 1: folders, items (uploaded file OR external link), department visibility,
// publish gate, search. Player + watch tracking + share links come next.
// Visibility mirrors training: nothing is visible until leadership PUBLISHES it,
// and departments default to everyone.
const DEPTS = [
  { id: 'everyone', label: 'Everyone' },
  { id: 'leadership', label: 'Leadership' },
  { id: 'customer_support', label: 'Customer Support' },
  { id: 'credit_consultants', label: 'Consultants' },
  { id: 'account_managers', label: 'Account Managers' },
  { id: 'communications', label: 'Communications' },
  { id: 'credit_team', label: 'Credit Team' },
];

export default function MediaLibrary() {
  const { supabaseFetch, supabasePost, supabasePatch, supabaseDelete, currentUser } = useApp();
  const isLeadership = currentUser?.department === 'leadership' || currentUser?.role === 'admin';
  const [folders, setFolders] = useState([]);
  const [items, setItems] = useState([]);
  const [folderId, setFolderId] = useState(null);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', kind: 'link', url: '', categories: '', departments: ['everyone'] });
  const [file, setFile] = useState(null);

  const load = async () => {
    const [f, i] = await Promise.all([
      supabaseFetch('media_folders', 'select=*&order=sort_order,name'),
      supabaseFetch('media_items', 'select=*&order=created_at.desc'),
    ]);
    setFolders(f || []); setItems(i || []); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const visible = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (items || []).filter(it => {
      if (!isLeadership) {
        if (!it.is_published) return false;
        const d = Array.isArray(it.departments) ? it.departments : ['everyone'];
        if (!d.includes('everyone') && !d.includes(currentUser?.department)) return false;
      }
      if (folderId && it.folder_id !== folderId) return false;
      if (!t) return true;
      return [it.title, it.description, it.ai_summary, (it.categories || []).join(' ')]
        .some(v => String(v || '').toLowerCase().includes(t));
    });
  }, [items, folderId, q, isLeadership, currentUser]);

  const addFolder = async () => {
    const name = window.prompt('Folder name');
    if (!name) return;
    await supabasePost('media_folders', { name, created_by: currentUser?.id, sort_order: folders.length });
    load();
  };

  const save = async () => {
    if (!form.title.trim() || saving) return;
    setSaving(true);
    try {
      let storage_path = null, url = form.url.trim();
      if (form.kind === 'upload') {
        if (!file) { alert('Choose a file first.'); setSaving(false); return; }
        const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const { error } = await supabase.storage.from('media-library').upload(path, file, { upsert: false, contentType: file.type || 'video/mp4' });
        if (error) throw new Error(error.message);
        const { data: pub } = supabase.storage.from('media-library').getPublicUrl(path);
        storage_path = path; url = pub?.publicUrl || '';
      }
      await supabasePost('media_items', {
        title: form.title.trim(),
        description: form.description.trim() || null,
        folder_id: folderId,
        kind: form.kind,
        url: url || null,
        storage_path,
        categories: form.categories.split(',').map(c => c.trim()).filter(Boolean),
        departments: form.departments.length ? form.departments : ['everyone'],
        created_by: currentUser?.id,
        is_published: false,
      });
      setShowAdd(false); setFile(null);
      fetch('/.netlify/functions/media-describe-background', { method: 'POST' }).catch(() => {}); // AI summary, fire-and-forget
      setForm({ title: '', description: '', kind: 'link', url: '', categories: '', departments: ['everyone'] });
      load();
    } catch (e) { alert('Could not save: ' + e.message); }
    setSaving(false);
  };

  const togglePublish = async (it) => { await supabasePatch('media_items', it.id, { is_published: !it.is_published, updated_at: new Date().toISOString() }); load(); };
  const removeItem = async (it) => { if (!window.confirm(`Delete "${it.title}"?`)) return; await supabaseDelete('media_items', `id=eq.${it.id}`); load(); };
  const toggleDept = (d) => setForm(p => ({ ...p, departments: p.departments.includes(d) ? p.departments.filter(x => x !== d) : [...p.departments.filter(x => x !== 'everyone' || d === 'everyone'), d] }));

  const folderName = (id) => (folders.find(x => x.id === id) || {}).name || 'All Videos';

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Video className="w-6 h-6 text-asap-blue" /> Media Library</h1>
          <p className="text-sm text-slate-500 mt-0.5">Trainings, SOP videos, and marketing media - organized by folder and department.</p>
        </div>
        {isLeadership && (
          <div className="flex gap-2">
            <button onClick={addFolder} className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-1.5"><FolderPlus className="w-4 h-4" /> New Folder</button>
            <button onClick={() => setShowAdd(true)} className="px-4 py-2 rounded-xl bg-asap-blue text-white text-sm font-medium hover:bg-asap-blue-dark flex items-center gap-1.5"><Plus className="w-4 h-4" /> Add Video</button>
          </div>
        )}
      </div>
      <div className="relative mb-4">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search titles, descriptions, AI summaries..."
          className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-asap-blue" />
      </div>
      <div className="flex gap-5">
        <aside className="w-52 shrink-0">
          <button onClick={() => setFolderId(null)} className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${!folderId ? 'bg-blue-50 text-asap-blue font-medium' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Folder className="w-4 h-4" /> All Videos
          </button>
          {folders.map(fo => (
            <button key={fo.id} onClick={() => setFolderId(fo.id)} className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${folderId === fo.id ? 'bg-blue-50 text-asap-blue font-medium' : 'text-slate-600 hover:bg-slate-50'}`}>
              <Folder className="w-4 h-4" /> <span className="truncate">{fo.name}</span>
            </button>
          ))}
        </aside>
        <main className="flex-1 min-w-0">
          {loading ? (
            <div className="flex items-center gap-2 text-slate-400 text-sm py-10 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>
          ) : visible.length === 0 ? (
            <div className="text-center text-slate-400 text-sm py-16 border border-dashed border-slate-200 rounded-2xl">
              No videos here yet{isLeadership ? ' - add the first one.' : '.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {visible.map(it => (
                <div key={it.id} className={`border rounded-2xl p-4 bg-white flex flex-col gap-2 ${it.is_published ? 'border-slate-200' : 'border-amber-300 bg-amber-50/40'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-slate-800 text-sm leading-snug">{it.title}</div>
                    {isLeadership && (
                      <div className="flex gap-1 shrink-0">
                        <button title={it.is_published ? 'Published - click to unpublish' : 'Draft - click to publish'} onClick={() => togglePublish(it)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
                          {it.is_published ? <Eye className="w-4 h-4 text-emerald-600" /> : <EyeOff className="w-4 h-4 text-amber-500" />}
                        </button>
                        <button title="Delete" onClick={() => removeItem(it)} className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-500"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    )}
                  </div>
                  {it.description && <div className="text-xs text-slate-500 line-clamp-2">{it.description}</div>}
                  {it.ai_summary && <div className="text-xs text-slate-400 line-clamp-2 italic">{it.ai_summary}</div>}
                  <div className="flex items-center gap-1.5 flex-wrap mt-auto pt-1">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{folderName(it.folder_id)}</span>
                    {(Array.isArray(it.departments) ? it.departments : []).map(d => (
                      <span key={d} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-asap-blue">{(DEPTS.find(x => x.id === d) || {}).label || d}</span>
                    ))}
                    {!it.is_published && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">DRAFT</span>}
                  </div>
                  {it.url && (
                    <a href={it.url} target="_blank" rel="noreferrer" className="text-xs text-asap-blue hover:underline flex items-center gap-1 mt-1"><Link2 className="w-3.5 h-3.5" /> Open video</a>
                  )}
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="font-bold text-slate-800">Add Video</div>
              <button onClick={() => setShowAdd(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <input value={form.title} onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Title"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-asap-blue" />
              <textarea value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Description (optional - AI will also summarize)" rows={2}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-asap-blue resize-none" />
              <div className="flex gap-2">
                <button onClick={() => setForm(p => ({ ...p, kind: 'link' }))} className={`flex-1 px-3 py-2 rounded-xl border text-sm flex items-center justify-center gap-1.5 ${form.kind === 'link' ? 'border-asap-blue bg-blue-50 text-asap-blue font-medium' : 'border-slate-200 text-slate-500'}`}><Link2 className="w-4 h-4" /> Link (Drive/YouTube)</button>
                <button onClick={() => setForm(p => ({ ...p, kind: 'upload' }))} className={`flex-1 px-3 py-2 rounded-xl border text-sm flex items-center justify-center gap-1.5 ${form.kind === 'upload' ? 'border-asap-blue bg-blue-50 text-asap-blue font-medium' : 'border-slate-200 text-slate-500'}`}><Upload className="w-4 h-4" /> Upload file</button>
              </div>
              {form.kind === 'link' ? (
                <input value={form.url} onChange={(e) => setForm(p => ({ ...p, url: e.target.value }))} placeholder="https://drive.google.com/... or https://youtube.com/..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-asap-blue" />
              ) : (
                <input type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] || null)} className="w-full text-sm text-slate-600" />
              )}
              <input value={form.categories} onChange={(e) => setForm(p => ({ ...p, categories: e.target.value }))} placeholder="Categories, comma-separated (optional)"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-asap-blue" />
              <div>
                <div className="text-xs font-medium text-slate-500 mb-1.5">Visible to</div>
                <div className="flex flex-wrap gap-1.5">
                  {DEPTS.map(d => (
                    <button key={d.id} onClick={() => toggleDept(d.id)} className={`text-xs px-2.5 py-1 rounded-lg border ${form.departments.includes(d.id) ? 'border-asap-blue bg-blue-50 text-asap-blue font-medium' : 'border-slate-200 text-slate-500'}`}>{d.label}</button>
                  ))}
                </div>
              </div>
              <div className="text-[11px] text-slate-400">Saved as a DRAFT - publish from the card when ready. Video lands in the folder selected on the left.</div>
              <button onClick={save} disabled={saving} className="w-full py-2.5 rounded-xl bg-asap-blue text-white text-sm font-semibold hover:bg-asap-blue-dark disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Video'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

