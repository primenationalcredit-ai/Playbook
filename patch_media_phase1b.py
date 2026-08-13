import sys, re
f = 'src/pages/MediaLibrary.jsx'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
if 'showAdd && (' in s or '<div className="p-6' in s: print("ABORTED: UI truly present"); sys.exit(1)
tail = """
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
"""
a_end = "const toggleDept = (d) => setForm(p => ({ ...p, departments: p.departments.includes(d) ? p.departments.filter(x => x !== d) : [...p.departments.filter(x => x !== 'everyone' || d === 'everyone'), d] }));"
if s.count(a_end) != 1: print("ABORTED: tail anchor x" + str(s.count(a_end))); sys.exit(1)
s = s.replace(a_end, a_end + "\n" + tail, 1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
print("MediaLibrary.jsx completed (+UI)")
fa = 'src/App.jsx'
sa = open(fa, encoding='utf-8', errors='surrogateescape').read()
if 'MediaLibrary' in sa: print("route: already there, skipping")
else:
    ra = '<Route path="sops" element={<SopLibrary />} />'
    if sa.count(ra) != 1: print("ABORTED: route anchor x" + str(sa.count(ra))); sys.exit(1)
    sa = sa.replace(ra, ra + '\n            <Route path="media" element={<MediaLibrary />} />', 1)
    m = re.search(r"import SopLibrary from [^\n]+\n", sa)
    if not m: print("ABORTED: SopLibrary import not found"); sys.exit(1)
    sa = sa[:m.end()] + "import MediaLibrary from './pages/MediaLibrary';\n" + sa[m.end():]
    open(fa, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(sa)
    print("App.jsx routed /media")
fl = 'src/components/Layout.jsx'
sl = open(fl, encoding='utf-8', errors='surrogateescape').read()
if "'/media'" in sl or '"/media"' in sl: print("nav: already there, skipping")
else:
    mm = re.search(r"\{[^{}]*path:\s*'/sops'[^{}]*\}", sl)
    if not mm: print("NAV NOT PATCHED: no /sops item matched - report back, page still reachable at /media"); sys.exit(0)
    item = mm.group(0)
    media_item = item.replace("'/sops'", "'/media'")
    media_item = re.sub(r"label:\s*'[^']*'", "label: 'Media Library'", media_item)
    media_item = re.sub(r"icon:\s*[A-Za-z0-9_]+", "icon: Video", media_item)
    sl = sl.replace(item, item + ", " + media_item, 1)
    if not re.search(r"import \{[^}]*\bVideo\b[^}]*\} from 'lucide-react'", sl):
        lm = re.search(r"import \{([^}]*)\} from 'lucide-react'", sl)
        if lm: sl = sl.replace(lm.group(0), "import {" + lm.group(1) + ", Video } from 'lucide-react'", 1)
    open(fl, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(sl)
    print("Layout.jsx nav item added")
