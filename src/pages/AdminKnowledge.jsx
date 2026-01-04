import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Database,
  Plus, 
  Edit2, 
  Trash2, 
  Search,
  X,
  Save,
  BookOpen,
  MessageSquare,
  DollarSign,
  RefreshCw,
  Lightbulb,
  Shield,
  Star,
  FileText,
  Upload,
  AlertCircle
} from 'lucide-react';

const SUPABASE_URL = 'https://kkcbpqbcpzcarxhknzza.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0';

const CATEGORIES = [
  { id: 'objections', name: 'Objections', icon: MessageSquare, color: 'red', description: 'Common client objections and rebuttals' },
  { id: 'pricing', name: 'Pricing', icon: DollarSign, color: 'green', description: 'Pricing info and value propositions' },
  { id: 'process', name: 'Process', icon: RefreshCw, color: 'purple', description: 'How credit repair works' },
  { id: 'faq', name: 'FAQ', icon: Lightbulb, color: 'amber', description: 'Frequently asked questions' },
  { id: 'scripts', name: 'Scripts', icon: FileText, color: 'blue', description: 'Call scripts and talk tracks' },
  { id: 'compliance', name: 'Compliance', icon: Shield, color: 'slate', description: 'Legal and compliance guidelines' },
  { id: 'success_stories', name: 'Success Stories', icon: Star, color: 'yellow', description: 'Client success stories and proof points' },
];

export default function AdminKnowledge() {
  const { currentUser } = useApp();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const isAdmin = currentUser?.role === 'admin' || currentUser?.department === 'leadership';

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    setLoading(true);
    try {
      const url = `${SUPABASE_URL}/rest/v1/knowledge_base?select=*&order=category,priority.desc,title`;
      const res = await fetch(url, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        }
      });
      if (res.ok) {
        const data = await res.json();
        setEntries(data || []);
      }
    } catch (error) {
      console.error('Error loading knowledge base:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (entryData) => {
    try {
      if (editingEntry) {
        // Update
        await fetch(`${SUPABASE_URL}/rest/v1/knowledge_base?id=eq.${editingEntry.id}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            ...entryData,
            updated_at: new Date().toISOString()
          })
        });
      } else {
        // Create
        await fetch(`${SUPABASE_URL}/rest/v1/knowledge_base`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            ...entryData,
            created_by: currentUser?.id
          })
        });
      }
      
      await loadEntries();
      setShowModal(false);
      setEditingEntry(null);
    } catch (error) {
      console.error('Error saving entry:', error);
    }
  };

  const handleDelete = async (id) => {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/knowledge_base?id=eq.${id}`, {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        }
      });
      await loadEntries();
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting entry:', error);
    }
  };

  const toggleActive = async (entry) => {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/knowledge_base?id=eq.${entry.id}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_active: !entry.is_active })
      });
      await loadEntries();
    } catch (error) {
      console.error('Error toggling active:', error);
    }
  };

  const filteredEntries = entries.filter(entry => {
    const matchesSearch = !searchQuery || 
      entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || entry.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getCategoryInfo = (categoryId) => {
    return CATEGORIES.find(c => c.id === categoryId) || { name: categoryId, color: 'slate' };
  };

  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 text-yellow-700 p-4 rounded-lg">
          This page is only available to administrators.
        </div>
      </div>
    );
  }

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
        <button
          onClick={() => { setEditingEntry(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg"
        >
          <Plus size={20} />
          Add Entry
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Search knowledge base..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
        >
          <option value="all">All Categories</option>
          {CATEGORIES.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      </div>

      {/* Category Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        {CATEGORIES.map(cat => {
          const count = entries.filter(e => e.category === cat.id).length;
          const Icon = cat.icon;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id === selectedCategory ? 'all' : cat.id)}
              className={`p-3 rounded-xl border-2 transition-all ${
                selectedCategory === cat.id 
                  ? `border-${cat.color}-500 bg-${cat.color}-50` 
                  : 'border-slate-100 bg-white hover:border-slate-200'
              }`}
            >
              <Icon size={20} className={`text-${cat.color}-500 mx-auto mb-1`} />
              <p className="text-xs text-slate-500">{cat.name}</p>
              <p className="text-lg font-bold text-slate-700">{count}</p>
            </button>
          );
        })}
      </div>

      {/* Entries List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {filteredEntries.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-2xl">
              <BookOpen size={40} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">No entries found</p>
              <button
                onClick={() => { setEditingEntry(null); setShowModal(true); }}
                className="mt-4 text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Add your first entry
              </button>
            </div>
          ) : (
            filteredEntries.map(entry => {
              const catInfo = getCategoryInfo(entry.category);
              return (
                <div 
                  key={entry.id} 
                  className={`bg-white rounded-xl border-2 p-4 transition-all ${
                    entry.is_active ? 'border-slate-100' : 'border-slate-200 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-0.5 text-xs rounded-full bg-${catInfo.color}-100 text-${catInfo.color}-700`}>
                          {catInfo.name}
                        </span>
                        {entry.priority > 5 && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700 flex items-center gap-1">
                            <Star size={10} /> High Priority
                          </span>
                        )}
                        {!entry.is_active && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-500">
                            Inactive
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-slate-800 mb-1">{entry.title}</h3>
                      <p className="text-sm text-slate-500 line-clamp-2">{entry.content}</p>
                      {entry.keywords?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {entry.keywords.slice(0, 5).map((kw, i) => (
                            <span key={i} className="px-2 py-0.5 text-xs bg-slate-100 text-slate-500 rounded">
                              {kw}
                            </span>
                          ))}
                          {entry.keywords.length > 5 && (
                            <span className="px-2 py-0.5 text-xs text-slate-400">
                              +{entry.keywords.length - 5} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleActive(entry)}
                        className={`p-2 rounded-lg transition-colors ${
                          entry.is_active 
                            ? 'text-green-600 hover:bg-green-50' 
                            : 'text-slate-400 hover:bg-slate-100'
                        }`}
                        title={entry.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {entry.is_active ? '✓' : '○'}
                      </button>
                      <button
                        onClick={() => { setEditingEntry(entry); setShowModal(true); }}
                        className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(entry.id)}
                        className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <EntryModal
          entry={editingEntry}
          categories={CATEGORIES}
          onClose={() => { setShowModal(false); setEditingEntry(null); }}
          onSave={handleSave}
        />
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-800">Delete Entry?</h3>
            </div>
            <p className="text-slate-600 mb-6">
              This will permanently remove this entry from the knowledge base. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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

    onSave({
      title: title.trim(),
      category,
      content: content.trim(),
      keywords: keywords.split(',').map(k => k.trim().toLowerCase()).filter(k => k),
      priority,
      is_active: isActive
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl my-8">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-xl font-semibold text-slate-800">
            {entry ? 'Edit Entry' : 'Add New Entry'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Priority (1-10)</label>
              <input
                type="number"
                min="1"
                max="10"
                value={priority}
                onChange={(e) => setPriority(parseInt(e.target.value) || 5)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Client says it's too expensive"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Content *</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="The detailed response, script, or information..."
              rows={10}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
              required
            />
            <p className="text-xs text-slate-400 mt-1">Supports markdown formatting: **bold**, *italic*, bullet points</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Keywords (comma-separated)</label>
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="expensive, cost, price, money, afford"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-slate-400 mt-1">Keywords help the AI find this entry when users ask questions</p>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="isActive" className="text-sm text-slate-700">
              Active (visible in AI responses)
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all flex items-center justify-center gap-2"
            >
              <Save size={18} />
              {entry ? 'Update Entry' : 'Add Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
