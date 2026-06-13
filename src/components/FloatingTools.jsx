import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  MessageSquarePlus,
  StickyNote,
  BookOpen,
  X,
  Plus,
  Save,
  Trash2,
  ChevronRight,
  Search,
  Lightbulb,
  Copy,
  Check,
  Edit3,
  FolderOpen,
} from 'lucide-react';

function FloatingTools() {
  const { currentUser, supabaseFetch } = useApp();
  
  const [showMenu, setShowMenu] = useState(false);
  const [activePanel, setActivePanel] = useState(null); // 'notepad', 'quickref', 'feature'
  
  // Notepad state
  const [notes, setNotes] = useState([]);
  const [activeNote, setActiveNote] = useState(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  
  // Quick Reference state
  const [quickRefs, setQuickRefs] = useState([]);
  const [activeRef, setActiveRef] = useState(null);
  const [refTitle, setRefTitle] = useState('');
  const [refContent, setRefContent] = useState('');
  const [refCategory, setRefCategory] = useState('scripts');
  const [refSearch, setRefSearch] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  
  // Feature Request state
  const [featureTitle, setFeatureTitle] = useState('');
  const [featureDescription, setFeatureDescription] = useState('');
  const [featureSubmitting, setFeatureSubmitting] = useState(false);
  const [featureSubmitted, setFeatureSubmitted] = useState(false);

  useEffect(() => {
    if (currentUser && activePanel === 'notepad') {
      loadNotes();
    }
    if (currentUser && activePanel === 'quickref') {
      loadQuickRefs();
    }
  }, [currentUser, activePanel]);

  const loadNotes = async () => {
    try {
      const data = await supabaseFetch('user_notes', `user_id=eq.${currentUser.id}&order=updated_at.desc`);
      setNotes(data || []);
    } catch (err) {
      console.error('Error loading notes:', err);
    }
  };

  const loadQuickRefs = async () => {
    try {
      // Load user's personal refs and shared refs
      const data = await supabaseFetch('quick_references', `or=(user_id.eq.${currentUser.id},is_shared.eq.true)&order=title.asc`);
      setQuickRefs(data || []);
    } catch (err) {
      console.error('Error loading quick refs:', err);
    }
  };

  const saveNote = async () => {
    if (!noteTitle.trim()) return;
    setNoteSaving(true);
    
    try {
      if (activeNote) {
        // Update existing
        await supabaseFetch('user_notes', '', {
          method: 'PATCH',
          body: JSON.stringify({ title: noteTitle, content: noteContent, updated_at: new Date().toISOString() }),
          matchColumn: 'id',
          matchValue: activeNote.id
        });
      } else {
        // Create new
        await supabaseFetch('user_notes', '', {
          method: 'POST',
          body: JSON.stringify({ user_id: currentUser.id, title: noteTitle, content: noteContent })
        });
      }
      await loadNotes();
      setActiveNote(null);
      setNoteTitle('');
      setNoteContent('');
    } catch (err) {
      console.error('Error saving note:', err);
    } finally {
      setNoteSaving(false);
    }
  };

  const deleteNote = async (id) => {
    if (!confirm('Delete this note?')) return;
    try {
      await supabaseFetch('user_notes', '', {
        method: 'DELETE',
        matchColumn: 'id',
        matchValue: id
      });
      await loadNotes();
      if (activeNote?.id === id) {
        setActiveNote(null);
        setNoteTitle('');
        setNoteContent('');
      }
    } catch (err) {
      console.error('Error deleting note:', err);
    }
  };

  const saveQuickRef = async () => {
    if (!refTitle.trim() || !refContent.trim()) return;
    
    try {
      if (activeRef) {
        await supabaseFetch('quick_references', '', {
          method: 'PATCH',
          body: JSON.stringify({ title: refTitle, content: refContent, category: refCategory }),
          matchColumn: 'id',
          matchValue: activeRef.id
        });
      } else {
        await supabaseFetch('quick_references', '', {
          method: 'POST',
          body: JSON.stringify({ user_id: currentUser.id, title: refTitle, content: refContent, category: refCategory })
        });
      }
      await loadQuickRefs();
      setActiveRef(null);
      setRefTitle('');
      setRefContent('');
    } catch (err) {
      console.error('Error saving quick ref:', err);
    }
  };

  const deleteQuickRef = async (id) => {
    if (!confirm('Delete this reference?')) return;
    try {
      await supabaseFetch('quick_references', '', {
        method: 'DELETE',
        matchColumn: 'id',
        matchValue: id
      });
      await loadQuickRefs();
    } catch (err) {
      console.error('Error deleting quick ref:', err);
    }
  };

  const copyToClipboard = async (text, id) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const submitFeatureRequest = async () => {
    if (!featureTitle.trim()) return;
    setFeatureSubmitting(true);
    
    try {
      await supabaseFetch('feature_requests', '', {
        method: 'POST',
        body: JSON.stringify({
          user_id: currentUser.id,
          user_name: currentUser.name,
          title: featureTitle,
          description: featureDescription,
          status: 'pending'
        })
      });
      setFeatureSubmitted(true);
      setFeatureTitle('');
      setFeatureDescription('');
      setTimeout(() => {
        setFeatureSubmitted(false);
        setActivePanel(null);
      }, 2000);
    } catch (err) {
      console.error('Error submitting feature request:', err);
    } finally {
      setFeatureSubmitting(false);
    }
  };

  const openPanel = (panel) => {
    setActivePanel(panel);
    setShowMenu(false);
  };

  const closePanel = () => {
    setActivePanel(null);
    setActiveNote(null);
    setActiveRef(null);
    setNoteTitle('');
    setNoteContent('');
    setRefTitle('');
    setRefContent('');
  };

  const filteredRefs = quickRefs.filter(ref => 
    ref.title.toLowerCase().includes(refSearch.toLowerCase()) ||
    ref.content.toLowerCase().includes(refSearch.toLowerCase())
  );

  const categories = [
    { id: 'scripts', label: 'Scripts', icon: '📜' },
    { id: 'responses', label: 'Responses', icon: '💬' },
    { id: 'data', label: 'Data/Info', icon: '📊' },
    { id: 'links', label: 'Links', icon: '🔗' },
  ];

  return (
    <>
      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-50">
        {showMenu && (
          <div className="absolute bottom-16 right-0 bg-white rounded-xl shadow-2xl border border-slate-200 p-2 min-w-[200px] animate-fade-in">
            <button
              onClick={() => openPanel('notepad')}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 rounded-lg transition-colors text-left"
            >
              <StickyNote className="w-5 h-5 text-amber-500" />
              <div>
                <p className="font-medium text-slate-800">Notepad</p>
                <p className="text-xs text-slate-500">Quick notes</p>
              </div>
            </button>
            <button
              onClick={() => openPanel('quickref')}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 rounded-lg transition-colors text-left"
            >
              <BookOpen className="w-5 h-5 text-blue-500" />
              <div>
                <p className="font-medium text-slate-800">Quick Reference</p>
                <p className="text-xs text-slate-500">Scripts & snippets</p>
              </div>
            </button>
            <div className="border-t border-slate-100 my-1"></div>
            <button
              onClick={() => openPanel('feature')}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 rounded-lg transition-colors text-left"
            >
              <Lightbulb className="w-5 h-5 text-purple-500" />
              <div>
                <p className="font-medium text-slate-800">Request Feature</p>
                <p className="text-xs text-slate-500">Suggest improvements</p>
              </div>
            </button>
          </div>
        )}
        
        <button
          onClick={() => setShowMenu(!showMenu)}
          className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all ${
            showMenu ? 'bg-slate-700 rotate-45' : 'bg-asap-blue hover:bg-asap-blue-dark'
          }`}
        >
          <Plus className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* Slide-out Panels */}
      {activePanel && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/20"
            onClick={closePanel}
          />
          
          {/* Panel */}
          <div className="relative w-full max-w-md bg-white shadow-2xl h-full overflow-hidden animate-slide-in-right">
            {/* Notepad Panel */}
            {activePanel === 'notepad' && (
              <div className="h-full flex flex-col">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-amber-50">
                  <div className="flex items-center gap-2">
                    <StickyNote className="w-5 h-5 text-amber-600" />
                    <h2 className="font-semibold text-slate-800">Notepad</h2>
                  </div>
                  <button onClick={closePanel} className="p-2 hover:bg-amber-100 rounded-lg">
                    <X className="w-5 h-5 text-slate-500" />
                  </button>
                </div>
                
                <div className="flex-1 overflow-hidden flex">
                  {/* Notes List */}
                  <div className="w-1/3 border-r border-slate-200 overflow-y-auto bg-slate-50">
                    <button
                      onClick={() => { setActiveNote(null); setNoteTitle(''); setNoteContent(''); }}
                      className="w-full p-3 flex items-center gap-2 text-amber-600 hover:bg-amber-50 border-b border-slate-200"
                    >
                      <Plus className="w-4 h-4" />
                      <span className="text-sm font-medium">New Note</span>
                    </button>
                    {notes.map(note => (
                      <button
                        key={note.id}
                        onClick={() => { setActiveNote(note); setNoteTitle(note.title); setNoteContent(note.content); }}
                        className={`w-full p-3 text-left border-b border-slate-100 hover:bg-white transition-colors ${
                          activeNote?.id === note.id ? 'bg-white border-l-2 border-l-amber-500' : ''
                        }`}
                      >
                        <p className="font-medium text-slate-800 text-sm truncate">{note.title}</p>
                        <p className="text-xs text-slate-400 truncate">{note.content?.substring(0, 50)}</p>
                      </button>
                    ))}
                  </div>
                  
                  {/* Note Editor */}
                  <div className="flex-1 flex flex-col p-4">
                    <input
                      type="text"
                      placeholder="Note title..."
                      value={noteTitle}
                      onChange={(e) => setNoteTitle(e.target.value)}
                      className="text-lg font-semibold border-0 border-b border-slate-200 pb-2 mb-3 focus:outline-none focus:border-amber-500"
                    />
                    <textarea
                      placeholder="Write your note..."
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      className="flex-1 resize-none border-0 focus:outline-none text-slate-600"
                    />
                    <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                      {activeNote && (
                        <button
                          onClick={() => deleteNote(activeNote.id)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={saveNote}
                        disabled={!noteTitle.trim() || noteSaving}
                        className="ml-auto flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50"
                      >
                        <Save className="w-4 h-4" />
                        {noteSaving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Reference Panel */}
            {activePanel === 'quickref' && (
              <div className="h-full flex flex-col">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-blue-50">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-blue-600" />
                    <h2 className="font-semibold text-slate-800">Quick Reference</h2>
                  </div>
                  <button onClick={closePanel} className="p-2 hover:bg-blue-100 rounded-lg">
                    <X className="w-5 h-5 text-slate-500" />
                  </button>
                </div>

                {activeRef !== null || refTitle ? (
                  // Edit/Create View
                  <div className="flex-1 flex flex-col p-4">
                    <button
                      onClick={() => { setActiveRef(null); setRefTitle(''); setRefContent(''); }}
                      className="text-sm text-blue-600 hover:text-blue-700 mb-3 flex items-center gap-1"
                    >
                      ← Back to list
                    </button>
                    <input
                      type="text"
                      placeholder="Title (e.g., 'Credit Dispute Script')"
                      value={refTitle}
                      onChange={(e) => setRefTitle(e.target.value)}
                      className="text-lg font-semibold border border-slate-200 rounded-lg px-3 py-2 mb-3 focus:outline-none focus:border-blue-500"
                    />
                    <select
                      value={refCategory}
                      onChange={(e) => setRefCategory(e.target.value)}
                      className="border border-slate-200 rounded-lg px-3 py-2 mb-3 focus:outline-none focus:border-blue-500"
                    >
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.icon} {cat.label}</option>
                      ))}
                    </select>
                    <textarea
                      placeholder="Content (script, response template, data, etc.)"
                      value={refContent}
                      onChange={(e) => setRefContent(e.target.value)}
                      className="flex-1 resize-none border border-slate-200 rounded-lg p-3 focus:outline-none focus:border-blue-500 text-slate-600 font-mono text-sm"
                    />
                    <div className="flex items-center justify-between pt-3">
                      {activeRef && (
                        <button
                          onClick={() => deleteQuickRef(activeRef.id)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={saveQuickRef}
                        disabled={!refTitle.trim() || !refContent.trim()}
                        className="ml-auto flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                      >
                        <Save className="w-4 h-4" />
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  // List View
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="p-3 border-b border-slate-200">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search scripts & references..."
                          value={refSearch}
                          onChange={(e) => setRefSearch(e.target.value)}
                          className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                        />
                      </div>
                    </div>
                    
                    <button
                      onClick={() => setRefTitle(' ')}
                      className="m-3 p-3 flex items-center gap-2 text-blue-600 hover:bg-blue-50 rounded-lg border border-dashed border-blue-300"
                    >
                      <Plus className="w-4 h-4" />
                      <span className="text-sm font-medium">Add New Reference</span>
                    </button>

                    <div className="flex-1 overflow-y-auto px-3 pb-3">
                      {categories.map(cat => {
                        const catRefs = filteredRefs.filter(r => r.category === cat.id);
                        if (catRefs.length === 0) return null;
                        
                        return (
                          <div key={cat.id} className="mb-4">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                              <span>{cat.icon}</span> {cat.label}
                            </p>
                            {catRefs.map(ref => (
                              <div
                                key={ref.id}
                                className="bg-white border border-slate-200 rounded-lg p-3 mb-2 hover:shadow-sm transition-shadow"
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <p className="font-medium text-slate-800">{ref.title}</p>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => copyToClipboard(ref.content, ref.id)}
                                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                      title="Copy to clipboard"
                                    >
                                      {copiedId === ref.id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                                    </button>
                                    {ref.user_id === currentUser.id && (
                                      <button
                                        onClick={() => { setActiveRef(ref); setRefTitle(ref.title); setRefContent(ref.content); setRefCategory(ref.category); }}
                                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                        title="Edit"
                                      >
                                        <Edit3 className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <pre className="text-xs text-slate-600 bg-slate-50 p-2 rounded whitespace-pre-wrap font-mono max-h-24 overflow-y-auto">
                                  {ref.content}
                                </pre>
                                {ref.is_shared && (
                                  <p className="text-xs text-blue-500 mt-2">🌐 Shared with team</p>
                                )}
                              </div>
                            ))}
                          </div>
                        );
                      })}
                      
                      {filteredRefs.length === 0 && (
                        <div className="text-center py-8 text-slate-400">
                          <FolderOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
                          <p>No references yet</p>
                          <p className="text-sm">Add scripts and snippets for quick access</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Feature Request Panel */}
            {activePanel === 'feature' && (
              <div className="h-full flex flex-col">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-purple-50">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-purple-600" />
                    <h2 className="font-semibold text-slate-800">Request a Feature</h2>
                  </div>
                  <button onClick={closePanel} className="p-2 hover:bg-purple-100 rounded-lg">
                    <X className="w-5 h-5 text-slate-500" />
                  </button>
                </div>

                {featureSubmitted ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Check className="w-8 h-8 text-green-600" />
                      </div>
                      <h3 className="text-xl font-semibold text-slate-800 mb-2">Thank You!</h3>
                      <p className="text-slate-600">Your feature request has been submitted.</p>
                      <p className="text-sm text-slate-500 mt-2">Leadership will review it soon.</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 p-4">
                    <p className="text-slate-600 mb-6">
                      Have an idea to improve the Playbook? We'd love to hear it! Submit your feature request below.
                    </p>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Feature Title *
                        </label>
                        <input
                          type="text"
                          placeholder="e.g., 'Add dark mode' or 'Mobile app'"
                          value={featureTitle}
                          onChange={(e) => setFeatureTitle(e.target.value)}
                          className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Description
                        </label>
                        <textarea
                          placeholder="Describe the feature and how it would help you..."
                          value={featureDescription}
                          onChange={(e) => setFeatureDescription(e.target.value)}
                          rows={6}
                          className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500 resize-none"
                        />
                      </div>
                      
                      <button
                        onClick={submitFeatureRequest}
                        disabled={!featureTitle.trim() || featureSubmitting}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium"
                      >
                        <MessageSquarePlus className="w-5 h-5" />
                        {featureSubmitting ? 'Submitting...' : 'Submit Request'}
                      </button>
                    </div>
                    
                    <p className="text-xs text-slate-400 mt-4 text-center">
                      Submitted as {currentUser?.name}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slide-in-right {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </>
  );
}

export default FloatingTools;
