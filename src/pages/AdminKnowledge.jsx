import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { 
  Database, Plus, Edit2, Trash2, Search, X, Save, BookOpen,
  MessageSquare, DollarSign, RefreshCw, Lightbulb, Shield, Star, FileText,
  Upload, AlertCircle, Check, ChevronDown, ChevronUp, File, Sparkles,
  Loader, Eye, EyeOff, Send, Layers
} from 'lucide-react';
import { extractTextFromPDF, isPDFFile } from '../utils/pdfUtils';
import ChunkedPDFProcessor from '../components/ChunkedPDFProcessor';

const SUPABASE_URL = 'https://kkcbpqbcpzcarxhknzza.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0';

const CATEGORIES = [
  { id: 'company_info', name: 'Company Info', icon: Database, color: 'blue', description: 'Location, history, team info, about us' },
  { id: 'objections', name: 'Objections', icon: MessageSquare, color: 'red', description: 'Common client objections and rebuttals' },
  { id: 'pricing', name: 'Pricing', icon: DollarSign, color: 'green', description: 'Pricing info and value propositions' },
  { id: 'process', name: 'Process', icon: RefreshCw, color: 'purple', description: 'How credit repair works' },
  { id: 'faq', name: 'FAQ', icon: Lightbulb, color: 'amber', description: 'Frequently asked questions' },
  { id: 'scripts', name: 'Scripts', icon: FileText, color: 'blue', description: 'Call scripts and talk tracks' },
  { id: 'compliance', name: 'Compliance', icon: Shield, color: 'slate', description: 'Legal and compliance guidelines' },
  { id: 'success_stories', name: 'Success Stories', icon: Star, color: 'yellow', description: 'Client success stories and proof points' },
];

const DOC_PARSE_PROMPT = `You are an AI that extracts knowledge base entries from documents for a credit repair company called ASAP Credit Repair USA.

Read the document and extract INDIVIDUAL knowledge base entries. Each entry should be a standalone piece of information.

CATEGORIES: objections, pricing, process, faq, scripts, compliance, success_stories

RULES:
- Break document into MULTIPLE entries (one topic per entry)
- Write clear, actionable content employees can use
- Generate relevant keywords for each entry
- Set priority 1-10 (10 = critical daily info)
- Keep company voice: confident, professional, results-focused

Respond ONLY with valid JSON array, no markdown, no backticks:
[{"title":"Short title","category":"category_id","content":"Detailed content","keywords":["kw1","kw2"],"priority":5}]`;

export default function AdminKnowledge() {
  const { currentUser } = useApp();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showChunkedProcessor, setShowChunkedProcessor] = useState(false);
  const [unansweredQuestions, setUnansweredQuestions] = useState([]);
  const [flaggedResponses, setFlaggedResponses] = useState([]);
  const [showAnswerModal, setShowAnswerModal] = useState(null);
  const [showUnanswered, setShowUnanswered] = useState(true);
  const [showFlagged, setShowFlagged] = useState(true);

  const isAdmin = currentUser?.role === 'admin' || currentUser?.department === 'leadership';

  useEffect(() => { loadEntries(); loadUnansweredQuestions(); loadFlaggedResponses(); }, []);

  const loadEntries = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/knowledge_base?select=*&order=category,priority.desc,title`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      if (res.ok) setEntries(await res.json() || []);
    } catch (e) { console.error('Error loading KB:', e); }
    finally { setLoading(false); }
  };

  const loadUnansweredQuestions = async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/ai_unanswered_questions?status=eq.pending&select=*&order=created_at.desc&limit=50`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      if (res.ok) setUnansweredQuestions(await res.json() || []);
    } catch (e) { console.error('Error loading unanswered:', e); }
  };

  const loadFlaggedResponses = async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/ai_flagged_responses?status=eq.pending&select=*&order=created_at.desc&limit=50`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      if (res.ok) setFlaggedResponses(await res.json() || []);
    } catch (e) { console.error('Error loading flagged:', e); }
  };

  const dismissFlagged = async (id) => {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/ai_flagged_responses?id=eq.${id}`, {
        method: 'PATCH',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'resolved' })
      });
      loadFlaggedResponses();
    } catch (e) { console.error('Error dismissing:', e); }
  };

  const addFlaggedToKB = (flagged) => {
    setEditingEntry(null);
    setShowModal(true);
    // Pre-fill the modal with the correction content
    setTimeout(() => {
      const titleInput = document.querySelector('input[placeholder="e.g., How to handle price objection"]');
      const contentInput = document.querySelector('textarea[placeholder*="detailed answer"]');
      if (titleInput) titleInput.value = `Q: ${flagged.question?.substring(0, 50)}...`;
      if (contentInput) contentInput.value = flagged.correction;
    }, 100);
  };

  const handleSave = async (entryData) => {
    try {
      if (editingEntry) {
        await fetch(`${SUPABASE_URL}/rest/v1/knowledge_base?id=eq.${editingEntry.id}`, {
          method: 'PATCH',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
          body: JSON.stringify({ ...entryData, updated_at: new Date().toISOString() })
        });
      } else {
        await fetch(`${SUPABASE_URL}/rest/v1/knowledge_base`, {
          method: 'POST',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
          body: JSON.stringify({ ...entryData, created_by: currentUser?.id })
        });
      }
      await loadEntries();
      setShowModal(false);
      setEditingEntry(null);
    } catch (e) { console.error('Error saving:', e); }
  };

  const handleDelete = async (id) => {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/knowledge_base?id=eq.${id}`, {
        method: 'DELETE', headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      await loadEntries();
      setDeleteConfirm(null);
    } catch (e) { console.error('Error deleting:', e); }
  };

  const toggleActive = async (entry) => {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/knowledge_base?id=eq.${entry.id}`, {
        method: 'PATCH',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !entry.is_active })
      });
      await loadEntries();
    } catch (e) { console.error('Error toggling:', e); }
  };

  const resolveQuestion = async (qId) => {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/ai_unanswered_questions?id=eq.${qId}`, {
        method: 'PATCH',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'resolved' })
      });
      setUnansweredQuestions(prev => prev.filter(q => q.id !== qId));
    } catch (e) { console.error('Error resolving:', e); }
  };

  const handleAnswerQuestion = async (question, answerData) => {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/knowledge_base`, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ ...answerData, is_active: true, created_by: currentUser?.id })
      });
      await resolveQuestion(question.id);
      await loadEntries();
      setShowAnswerModal(null);
    } catch (e) { console.error('Error answering:', e); alert('Error saving answer.'); }
  };

  const filteredEntries = entries.filter(entry => {
    const matchesSearch = !searchQuery || entry.title.toLowerCase().includes(searchQuery.toLowerCase()) || entry.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || entry.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getCategoryInfo = (id) => CATEGORIES.find(c => c.id === id) || { name: id, color: 'slate' };

  // Process a single chunk from the large PDF (for ChunkedPDFProcessor)
  const processChunk = async (chunk, chunkIndex, totalChunks) => {
    try {
      const res = await fetch('/.netlify/functions/ask-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'parse_document',
          system: DOC_PARSE_PROMPT,
          messages: [{ 
            role: 'user', 
            content: `Parse this document section (pages ${chunk.startPage}-${chunk.endPage}) into knowledge base entries:\n\n---\n${chunk.text.substring(0, 12000)}\n---\n\nRespond ONLY with valid JSON array.` 
          }]
        })
      });
      
      if (!res.ok) throw new Error('AI parsing failed');
      const data = await res.json();
      let text = data.content?.[0]?.text || '';
      text = text.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
      const parsed = JSON.parse(text);
      
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Auto-save each chunk's entries to the database
        for (const entry of parsed) {
          try {
            await fetch(`${SUPABASE_URL}/rest/v1/knowledge_base`, {
              method: 'POST',
              headers: { 
                'apikey': SUPABASE_KEY, 
                'Authorization': `Bearer ${SUPABASE_KEY}`, 
                'Content-Type': 'application/json', 
                'Prefer': 'return=minimal' 
              },
              body: JSON.stringify({
                title: entry.title,
                category: entry.category || 'faq',
                content: entry.content,
                keywords: entry.keywords || [],
                priority: entry.priority || 5,
                is_active: true,
                created_by: currentUser?.id
              })
            });
          } catch (saveErr) {
            console.error('Error saving entry:', saveErr);
          }
        }
        return parsed;
      }
      return [];
    } catch (e) {
      console.error('Chunk parse error:', e);
      return [];
    }
  };

  // When all chunks are processed
  const onChunkedProcessingComplete = (allResults) => {
    const totalEntries = allResults.reduce((sum, r) => sum + (r.results?.length || 0), 0);
    loadEntries(); // Refresh the list
    alert(`✓ Processing complete!\n\n${totalEntries} knowledge base entries created from ${allResults.length} document sections.`);
  };

  if (!isAdmin) return (
    <div className="p-6"><div className="bg-yellow-50 text-yellow-700 p-4 rounded-lg">This page is only available to administrators.</div></div>
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
            <Database className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Knowledge Base</h1>
            <p className="text-slate-500 text-sm">{entries.length} entries • Powers ASAP AI responses</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/admin/company-profile"
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-teal-600 to-cyan-600 text-white rounded-xl hover:from-teal-700 hover:to-cyan-700 transition-all shadow-lg">
            <Database size={20} /> Company Profile
          </Link>
          <Link to="/admin/knowledge/assistant"
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all shadow-lg">
            <Sparkles size={20} /> AI Assistant
          </Link>
          <button onClick={() => setShowChunkedProcessor(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl hover:from-indigo-600 hover:to-purple-600 transition-all">
            <Layers size={20} /> Large PDF
          </button>
          <button onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all">
            <Upload size={20} /> Upload
          </button>
          <button onClick={() => { setEditingEntry(null); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2.5 border-2 border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-all">
            <Plus size={20} /> Add Entry
          </button>
        </div>
      </div>

      {/* Unanswered Questions */}
      {unansweredQuestions.length > 0 && (
        <div className="bg-amber-50 rounded-2xl border-2 border-amber-200 mb-6 overflow-hidden">
          <button onClick={() => setShowUnanswered(!showUnanswered)} className="w-full flex items-center justify-between p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-amber-600" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-amber-800">{unansweredQuestions.length} Unanswered Question{unansweredQuestions.length !== 1 ? 's' : ''}</h3>
                <p className="text-sm text-amber-600">Team members asked these and the AI couldn't find an answer — add knowledge to fix this.</p>
              </div>
            </div>
            {showUnanswered ? <ChevronUp size={20} className="text-amber-600" /> : <ChevronDown size={20} className="text-amber-600" />}
          </button>
          {showUnanswered && (
            <div className="px-5 pb-5 space-y-3 max-h-[400px] overflow-y-auto">
              {unansweredQuestions.map((q) => (
                <div key={q.id} className="bg-white rounded-xl p-4 border border-amber-100 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <p className="text-slate-800 font-medium">{q.question}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Asked by <span className="font-medium">{q.user_name || 'Unknown'}</span> • {q.mode || 'general'} mode • {new Date(q.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => setShowAnswerModal(q)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors font-medium">
                        <Send size={14} /> Answer
                      </button>
                      <button onClick={() => setShowUploadModal(true)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 transition-colors font-medium">
                        <Upload size={14} /> Upload Doc
                      </button>
                      <button onClick={() => resolveQuestion(q.id)}
                        className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-500 text-sm rounded-lg hover:bg-slate-50 transition-colors">
                        <Check size={14} /> Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* AI Response Corrections */}
      {flaggedResponses.length > 0 && (
        <div className="bg-amber-50 rounded-2xl border-2 border-amber-200 mb-6 overflow-hidden">
          <button onClick={() => setShowFlagged(!showFlagged)} className="w-full flex items-center justify-between p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                <Edit2 className="w-5 h-5 text-amber-600" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-amber-800">{flaggedResponses.length} AI Feedback to Review</h3>
                <p className="text-sm text-amber-600">Click "Add to AI Training" to teach the AI this information.</p>
              </div>
            </div>
            {showFlagged ? <ChevronUp size={20} className="text-amber-600" /> : <ChevronDown size={20} className="text-amber-600" />}
          </button>
          {showFlagged && (
            <div className="px-5 pb-5 space-y-3 max-h-[500px] overflow-y-auto">
              {flaggedResponses.map((f) => (
                <div key={f.id} className="bg-white rounded-xl p-4 border border-amber-100 shadow-sm">
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-medium text-slate-500 uppercase mb-1">Question Asked</p>
                      <p className="text-slate-800">{f.question}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3">
                      <p className="text-xs font-medium text-green-600 uppercase mb-1">Feedback from {f.user_name || 'team member'}</p>
                      <p className="text-slate-800 font-medium">{f.correction}</p>
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <p className="text-xs text-slate-400">
                        {new Date(f.created_at).toLocaleDateString()}
                      </p>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={async () => {
                            try {
                              // Add directly to AI training
                              await fetch(`${SUPABASE_URL}/rest/v1/ai_training`, {
                                method: 'POST',
                                headers: { 
                                  'apikey': SUPABASE_KEY, 
                                  'Authorization': `Bearer ${SUPABASE_KEY}`, 
                                  'Content-Type': 'application/json',
                                  'Prefer': 'return=minimal'
                                },
                                body: JSON.stringify({
                                  instruction: f.correction,
                                  category: 'company',
                                  priority: 7,
                                  source_question: f.question,
                                  created_by: currentUser?.id,
                                  created_by_name: currentUser?.name,
                                  is_active: true
                                })
                              });
                              // Mark as approved
                              await fetch(`${SUPABASE_URL}/rest/v1/ai_flagged_responses?id=eq.${f.id}`, {
                                method: 'PATCH',
                                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
                                body: JSON.stringify({ status: 'approved' })
                              });
                              loadFlaggedResponses();
                              alert('Added to AI Training! The AI will now use this information.');
                            } catch (err) {
                              console.error(err);
                              alert('Failed to add. Please try again.');
                            }
                          }}
                          className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors font-medium"
                        >
                          <Check size={14} /> Add to AI Training
                        </button>
                        <button 
                          onClick={() => dismissFlagged(f.id)}
                          className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-500 text-sm rounded-lg hover:bg-slate-50 transition-colors"
                        >
                          <X size={14} /> Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input type="text" placeholder="Search knowledge base..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
          <option value="all">All Categories</option>
          {CATEGORIES.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {CATEGORIES.slice(0, 4).map(cat => {
          const count = entries.filter(e => e.category === cat.id).length;
          return (
            <div key={cat.id} className="bg-white rounded-xl border border-slate-100 p-4">
              <div className="flex items-center gap-2 mb-1"><cat.icon size={16} className="text-slate-400" /><span className="text-sm text-slate-500">{cat.name}</span></div>
              <p className="text-2xl font-bold text-slate-800">{count}</p>
            </div>
          );
        })}
      </div>

      {/* Entries */}
      {loading ? (
        <div className="flex items-center justify-center py-12"><RefreshCw className="w-6 h-6 text-indigo-600 animate-spin" /></div>
      ) : (
        <div className="space-y-3">
          {filteredEntries.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Database size={48} className="mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No entries found</p>
            </div>
          ) : filteredEntries.map(entry => {
            const catInfo = getCategoryInfo(entry.category);
            return (
              <div key={entry.id} className={`bg-white rounded-xl border border-slate-100 p-4 hover:shadow-md transition-all ${!entry.is_active ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 bg-${catInfo.color}-100 text-${catInfo.color}-700 text-xs font-medium rounded-full`}>{catInfo.name}</span>
                      <span className="text-xs text-slate-400">Priority: {entry.priority}/10</span>
                      {!entry.is_active && <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-xs rounded-full">Inactive</span>}
                    </div>
                    <h3 className="font-semibold text-slate-800">{entry.title}</h3>
                    <p className="text-sm text-slate-500 mt-1 line-clamp-2">{entry.content}</p>
                    {entry.keywords?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {entry.keywords.slice(0, 5).map((kw, i) => <span key={i} className="px-2 py-0.5 bg-slate-50 text-slate-400 text-xs rounded-full">{kw}</span>)}
                        {entry.keywords.length > 5 && <span className="text-xs text-slate-400">+{entry.keywords.length - 5} more</span>}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-4">
                    <button onClick={() => toggleActive(entry)} className={`p-2 rounded-lg transition-colors ${entry.is_active ? 'text-green-600 hover:bg-green-50' : 'text-slate-400 hover:bg-slate-100'}`}>
                      {entry.is_active ? <Eye size={18} /> : <EyeOff size={18} />}
                    </button>
                    <button onClick={() => { setEditingEntry(entry); setShowModal(true); }} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                      <Edit2 size={18} />
                    </button>
                    <button onClick={() => setDeleteConfirm(entry.id)} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && <EntryModal entry={editingEntry} categories={CATEGORIES} onClose={() => { setShowModal(false); setEditingEntry(null); }} onSave={handleSave} />}
      {showUploadModal && <DocumentUploadModal categories={CATEGORIES} currentUser={currentUser} supabaseUrl={SUPABASE_URL} supabaseKey={SUPABASE_KEY} onClose={() => setShowUploadModal(false)} onComplete={() => { setShowUploadModal(false); loadEntries(); }} />}
      {showChunkedProcessor && (
        <ChunkedPDFProcessor
          title="Process Large PDF"
          processButtonText="Extract Knowledge Base Entries"
          onChunkProcessed={processChunk}
          onAllComplete={onChunkedProcessingComplete}
          onClose={() => setShowChunkedProcessor(false)}
        />
      )}
      {showAnswerModal && <AnswerQuestionModal question={showAnswerModal} categories={CATEGORIES} onClose={() => setShowAnswerModal(null)} onSave={handleAnswerQuestion} />}
      
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center"><AlertCircle className="w-5 h-5 text-red-600" /></div>
              <h3 className="text-lg font-semibold text-slate-800">Delete Entry?</h3>
            </div>
            <p className="text-slate-600 mb-6">This will permanently remove this entry. This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// ENTRY MODAL
// ============================================================
function EntryModal({ entry, categories, onClose, onSave }) {
  const [title, setTitle] = useState(entry?.title || '');
  const [category, setCategory] = useState(entry?.category || 'objections');
  const [content, setContent] = useState(entry?.content || '');
  const [keywords, setKeywords] = useState(entry?.keywords?.join(', ') || '');
  const [priority, setPriority] = useState(entry?.priority || 5);
  const [isActive, setIsActive] = useState(entry?.is_active ?? true);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    onSave({ title: title.trim(), category, content: content.trim(), keywords: keywords.split(',').map(k => k.trim().toLowerCase()).filter(k => k), priority, is_active: isActive });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl my-8">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-xl font-semibold text-slate-800">{entry ? 'Edit Entry' : 'Add New Entry'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X size={20} className="text-slate-500" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category *</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Priority (1-10)</label>
              <input type="number" min="1" max="10" value={priority} onChange={(e) => setPriority(parseInt(e.target.value) || 5)} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Client says it's too expensive" className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Content *</label>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="The detailed response, script, or information..." rows={10} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Keywords (comma-separated)</label>
            <input type="text" value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="expensive, cost, price, money" className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-indigo-600" />
            <span className="text-sm text-slate-700">Active (visible in AI responses)</span>
          </label>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50">Cancel</button>
            <button type="submit" className="flex-1 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 flex items-center justify-center gap-2">
              <Save size={18} /> {entry ? 'Update Entry' : 'Add Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// DOCUMENT UPLOAD MODAL
// ============================================================
function DocumentUploadModal({ categories, currentUser, supabaseUrl, supabaseKey, onClose, onComplete }) {
  const [uploadText, setUploadText] = useState('');
  const [uploadFileName, setUploadFileName] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parsedEntries, setParsedEntries] = useState([]);
  const [selectedParsed, setSelectedParsed] = useState(new Set());
  const [savingParsed, setSavingParsed] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const isPDF = isPDFFile(file);
    
    if (isPDF) {
      // Show loading state for PDF
      setUploadFileName(`Loading ${file.name}...`);
      setPdfLoading(true);
      
      try {
        const text = await extractTextFromPDF(file);
        if (!text || text.trim().length < 50) {
          alert('Could not extract text from this PDF.\n\nPossible reasons:\n• PDF is a scanned image (not searchable text)\n• PDF is encrypted or password-protected\n• PDF has no text content\n\nTry opening the PDF and copying the text manually.');
          setUploadFileName('');
          setPdfLoading(false);
          return;
        }
        setUploadText(text.substring(0, 15000));
        setUploadFileName(file.name);
      } catch (pdfErr) {
        console.error('PDF error:', pdfErr);
        alert(`Failed to read PDF: ${pdfErr.message}\n\nTry:\n• A smaller PDF (under 10MB)\n• Copy/paste the text directly instead`);
        setUploadFileName('');
      } finally {
        setPdfLoading(false);
      }
    } else {
      // Read as text
      setUploadFileName(file.name);
      try {
        const text = await file.text();
        setUploadText(text.substring(0, 15000));
      } catch (err) {
        alert('Cannot read this file. Supported: .pdf, .txt, .md, .csv. Or paste text directly.');
        setUploadFileName('');
      }
    }
  };

  const parseDocument = async () => {
    if (!uploadText.trim()) return;
    setParsing(true);
    setParsedEntries([]);
    try {
      const res = await fetch('/.netlify/functions/ask-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'parse_document',
          system: DOC_PARSE_PROMPT,
          messages: [{ role: 'user', content: `Parse this document into knowledge base entries:\n\n---\n${uploadText.substring(0, 12000)}\n---\n\nRespond ONLY with valid JSON array.` }]
        })
      });
      if (!res.ok) throw new Error('AI parsing failed');
      const data = await res.json();
      let text = data.content?.[0]?.text || '';
      text = text.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setParsedEntries(parsed);
        setSelectedParsed(new Set(parsed.map((_, i) => i)));
      } else {
        alert('AI could not extract entries. Try a different document.');
      }
    } catch (e) {
      console.error('Parse error:', e);
      alert('Error parsing document. Try again or use a shorter document.');
    } finally { setParsing(false); }
  };

  const saveEntries = async () => {
    const toSave = parsedEntries.filter((_, i) => selectedParsed.has(i));
    if (toSave.length === 0) return;
    setSavingParsed(true);
    let saved = 0;
    for (const entry of toSave) {
      try {
        await fetch(`${supabaseUrl}/rest/v1/knowledge_base`, {
          method: 'POST',
          headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
          body: JSON.stringify({ title: entry.title, category: entry.category, content: entry.content, keywords: entry.keywords || [], priority: entry.priority || 5, is_active: true, created_by: currentUser?.id })
        });
        saved++;
      } catch (e) { console.error('Save error:', entry.title, e); }
    }
    alert(`Saved ${saved} of ${toSave.length} entries to the Knowledge Base!`);
    setSavingParsed(false);
    onComplete();
  };

  const toggleEntry = (i) => {
    setSelectedParsed(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
  };

  const updateParsedEntry = (index, field, value) => {
    setParsedEntries(prev => prev.map((e, i) => i === index ? { ...e, [field]: value } : e));
  };

  const getCategoryInfo = (id) => categories.find(c => c.id === id) || { name: id, color: 'slate' };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-xl my-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
              <Upload className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-800">Upload Document to Knowledge Base</h2>
              <p className="text-sm text-slate-500">AI reads your document and creates entries automatically</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X size={20} className="text-slate-500" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Upload */}
          {parsedEntries.length === 0 && (
            <div className="space-y-6">
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                <h4 className="font-medium text-indigo-800 mb-2 flex items-center gap-2"><Sparkles size={16} /> How it works</h4>
                <ol className="text-sm text-indigo-700 space-y-1">
                  <li>1. Upload a file or paste text from any document</li>
                  <li>2. AI reads it and extracts individual knowledge entries</li>
                  <li>3. Review, edit if needed, then save to the Knowledge Base</li>
                  <li>4. ASAP AI can now answer questions using this knowledge</li>
                </ol>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Upload a File</label>
                <input ref={fileInputRef} type="file" accept=".txt,.md,.csv,.pdf" onChange={handleFileUpload} className="hidden" />
                <button onClick={() => !pdfLoading && fileInputRef.current?.click()} disabled={pdfLoading}
                  className={`w-full border-2 border-dashed rounded-xl p-8 transition-all group ${pdfLoading ? 'border-purple-300 bg-purple-50' : 'border-slate-300 hover:border-emerald-400 hover:bg-emerald-50/50'}`}>
                  <div className="text-center">
                    {pdfLoading ? (
                      <>
                        <Loader size={40} className="mx-auto mb-3 text-purple-500 animate-spin" />
                        <p className="font-medium text-purple-700">Reading PDF...</p>
                        <p className="text-sm text-purple-500 mt-1">This may take a moment for large files</p>
                      </>
                    ) : uploadFileName ? (
                      <>
                        <File size={40} className="mx-auto mb-3 text-emerald-500" />
                        <p className="font-medium text-emerald-700">{uploadFileName}</p>
                        <p className="text-sm text-slate-400 mt-1">Click to choose a different file</p>
                      </>
                    ) : (
                      <>
                        <File size={40} className="mx-auto mb-3 text-slate-300 group-hover:text-emerald-500" />
                        <p className="font-medium text-slate-600">Click to choose a file</p>
                        <p className="text-sm text-slate-400 mt-1">Supports: .pdf, .txt, .md, .csv</p>
                      </>
                    )}
                  </div>
                </button>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
                <div className="relative flex justify-center"><span className="bg-white px-4 text-sm text-slate-400">or paste text directly</span></div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Paste Document Text</label>
                <textarea value={uploadText} onChange={(e) => setUploadText(e.target.value)}
                  placeholder="Paste your document content here... (training manuals, policies, scripts, SOPs, etc.)"
                  rows={10} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm" />
                <p className="text-xs text-slate-400 mt-1">{uploadText.length > 0 ? `${uploadText.length.toLocaleString()} characters` : 'Paste any text — policies, scripts, training docs, procedures, etc.'}</p>
              </div>

              <button onClick={parseDocument} disabled={!uploadText.trim() || parsing}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium text-lg">
                {parsing ? <><Loader size={20} className="animate-spin" /> AI is reading your document...</> : <><Sparkles size={20} /> Parse with AI</>}
              </button>
            </div>
          )}

          {/* Step 2: Review */}
          {parsedEntries.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-800">AI found {parsedEntries.length} knowledge entries</h3>
                  <p className="text-sm text-slate-500">{selectedParsed.size} of {parsedEntries.length} selected. Click any entry to edit it before saving.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setSelectedParsed(new Set(parsedEntries.map((_, i) => i)))} className="text-sm text-indigo-600 hover:text-indigo-800">Select All</button>
                  <span className="text-slate-300">|</span>
                  <button onClick={() => setSelectedParsed(new Set())} className="text-sm text-slate-500 hover:text-slate-700">Deselect All</button>
                </div>
              </div>

              {parsedEntries.map((entry, index) => {
                const catInfo = getCategoryInfo(entry.category);
                const isSelected = selectedParsed.has(index);
                const isEditing = editingIndex === index;
                return (
                  <div key={index} className={`rounded-xl border-2 transition-all ${isSelected ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-100 bg-white'}`}>
                    <div className="p-4 cursor-pointer" onClick={() => toggleEntry(index)}>
                      <div className="flex items-start gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${isSelected ? 'bg-emerald-500' : 'border-2 border-slate-300'}`}>
                          {isSelected && <Check size={14} className="text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 bg-${catInfo.color}-100 text-${catInfo.color}-700 text-xs font-medium rounded-full`}>{catInfo.name}</span>
                            <span className="text-xs text-slate-400">Priority: {entry.priority}/10</span>
                            <button onClick={(e) => { e.stopPropagation(); setEditingIndex(isEditing ? null : index); }}
                              className="ml-auto text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                              <Edit2 size={12} /> {isEditing ? 'Done' : 'Edit'}
                            </button>
                          </div>
                          <h4 className="font-semibold text-slate-800">{entry.title}</h4>
                          <p className="text-sm text-slate-600 mt-1 line-clamp-3">{entry.content}</p>
                          {entry.keywords?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {entry.keywords.map((kw, i) => <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-500 text-xs rounded-full">{kw}</span>)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    {isEditing && (
                      <div className="px-4 pb-4 pt-2 border-t border-slate-100 space-y-3" onClick={(e) => e.stopPropagation()}>
                        <input type="text" value={entry.title} onChange={(e) => updateParsedEntry(index, 'title', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        <div className="grid grid-cols-2 gap-3">
                          <select value={entry.category} onChange={(e) => updateParsedEntry(index, 'category', e.target.value)}
                            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                            {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                          </select>
                          <input type="number" min="1" max="10" value={entry.priority} onChange={(e) => updateParsedEntry(index, 'priority', parseInt(e.target.value) || 5)}
                            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Priority" />
                        </div>
                        <textarea value={entry.content} onChange={(e) => updateParsedEntry(index, 'content', e.target.value)}
                          rows={4} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="flex gap-3 pt-4 sticky bottom-0 bg-white py-4 border-t border-slate-100">
                <button onClick={() => { setParsedEntries([]); setSelectedParsed(new Set()); }}
                  className="px-6 py-3 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50">← Back</button>
                <button onClick={saveEntries} disabled={selectedParsed.size === 0 || savingParsed}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium">
                  {savingParsed ? <><Loader size={18} className="animate-spin" /> Saving...</> : <><Save size={18} /> Save {selectedParsed.size} Entries to Knowledge Base</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ANSWER QUESTION MODAL
// ============================================================
function AnswerQuestionModal({ question, categories, onClose, onSave }) {
  const [title, setTitle] = useState(question.question || '');
  const [category, setCategory] = useState('faq');
  const [content, setContent] = useState('');
  const [keywords, setKeywords] = useState('');
  const [priority, setPriority] = useState(7);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const words = question.question.toLowerCase().replace(/[?!.,]/g, '').split(/\s+/)
      .filter(w => w.length > 3 && !['what','when','where','which','that','this','does','have','with','from','they','their','about','would','could','should'].includes(w));
    setKeywords(words.join(', '));
  }, [question]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    await onSave(question, {
      title: title.trim(), category, content: content.trim(),
      keywords: keywords.split(',').map(k => k.trim().toLowerCase()).filter(k => k), priority
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl my-8">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Send className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-slate-800">Answer This Question</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X size={20} className="text-slate-500" /></button>
        </div>

        <div className="mx-6 mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm text-amber-600 font-medium mb-1">Original Question</p>
          <p className="text-slate-800 font-medium">{question.question}</p>
          <p className="text-xs text-slate-400 mt-1">Asked by {question.user_name || 'Unknown'} • {new Date(question.created_at).toLocaleDateString()}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
            <p className="text-sm text-blue-700">Your answer becomes a Knowledge Base entry — the AI will use it to answer this question (and similar ones) going forward.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Priority (1-10)</label>
              <input type="number" min="1" max="10" value={priority} onChange={(e) => setPriority(parseInt(e.target.value) || 7)} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Entry Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Answer / Content *</label>
            <textarea value={content} onChange={(e) => setContent(e.target.value)}
              placeholder="Type the answer here. Be detailed — this is what the AI will use to respond in the future..."
              rows={8} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" required autoFocus />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Keywords (auto-generated)</label>
            <input type="text" value={keywords} onChange={(e) => setKeywords(e.target.value)} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving || !content.trim()}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 flex items-center justify-center gap-2 disabled:opacity-50">
              {saving ? <><Loader size={18} className="animate-spin" /> Saving...</> : <><Check size={18} /> Save Answer & Resolve</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
