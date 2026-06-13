import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Link as LinkIcon,
  ExternalLink,
  Filter,
  FileText,
  LayoutDashboard,
  GraduationCap,
  Users,
  CheckSquare,
  MessageSquare,
  AlertTriangle,
  Target,
  Table,
  Compass,
  Search,
  Star,
  Plus,
  Edit3,
  Trash2,
  X,
  Save,
} from 'lucide-react';

const SUPABASE_URL = 'https://kkcbpqbcpzcarxhknzza.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0';

const iconMap = {
  'filter': Filter,
  'file-text': FileText,
  'layout-dashboard': LayoutDashboard,
  'graduation-cap': GraduationCap,
  'users': Users,
  'check-square': CheckSquare,
  'message-square': MessageSquare,
  'alert-triangle': AlertTriangle,
  'target': Target,
  'table': Table,
  'compass': Compass,
  'link': LinkIcon,
};

const categoryColors = {
  filter: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: 'text-blue-500' },
  document: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', icon: 'text-purple-500' },
  tool: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', icon: 'text-green-500' },
  form: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', icon: 'text-orange-500' },
};

function QuickLinks() {
  const { currentUser } = useApp();
  const [links, setLinks] = useState([]);
  const [personalLinks, setPersonalLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingLink, setEditingLink] = useState(null);

  useEffect(() => {
    loadLinks();
  }, [currentUser]);

  const loadLinks = async () => {
    setLoading(true);
    try {
      // Fetch department links
      const deptQuery = currentUser?.department 
        ? `or=(department.eq.${currentUser.department},department.is.null)&is_active=eq.true&order=position.asc`
        : 'department=is.null&is_active=eq.true&order=position.asc';
      
      const response = await fetch(`${SUPABASE_URL}/rest/v1/quick_links?${deptQuery}`, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        }
      });
      const data = await response.json();
      
      // Separate department links from personal links
      const deptLinks = data.filter(l => !l.user_id);
      const userLinks = data.filter(l => l.user_id === currentUser?.id);
      
      setLinks(deptLinks || []);
      setPersonalLinks(userLinks || []);
    } catch (err) {
      console.error('Error loading links:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveLink = async (linkData) => {
    try {
      const url = editingLink?.id 
        ? `${SUPABASE_URL}/rest/v1/quick_links?id=eq.${editingLink.id}`
        : `${SUPABASE_URL}/rest/v1/quick_links`;
      
      await fetch(url, {
        method: editingLink?.id ? 'PATCH' : 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          ...linkData,
          user_id: currentUser.id, // Personal link
          department: currentUser.department,
        })
      });
      
      setShowAddModal(false);
      setEditingLink(null);
      loadLinks();
    } catch (err) {
      console.error('Error saving link:', err);
    }
  };

  const deleteLink = async (linkId) => {
    if (!confirm('Delete this link?')) return;
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/quick_links?id=eq.${linkId}`, {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        }
      });
      loadLinks();
    } catch (err) {
      console.error('Error deleting link:', err);
    }
  };

  // Filter links
  const allLinks = [...links, ...personalLinks];
  const filteredLinks = allLinks.filter(link => {
    if (searchTerm && !link.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (activeCategory !== 'all' && link.category !== activeCategory) return false;
    return true;
  });

  // Group by category
  const groupedLinks = {
    filter: filteredLinks.filter(l => l.category === 'filter'),
    document: filteredLinks.filter(l => l.category === 'document'),
    tool: filteredLinks.filter(l => l.category === 'tool'),
    form: filteredLinks.filter(l => l.category === 'form'),
  };

  const categories = [
    { id: 'all', label: 'All', count: filteredLinks.length },
    { id: 'filter', label: 'Filters', count: groupedLinks.filter.length },
    { id: 'document', label: 'Documents', count: groupedLinks.document.length },
    { id: 'tool', label: 'Tools', count: groupedLinks.tool.length },
    { id: 'form', label: 'Forms', count: groupedLinks.form.length },
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Quick Links</h1>
          <p className="text-slate-500">Your filters, documents, and tools in one place</p>
        </div>
        <button
          onClick={() => { setEditingLink(null); setShowAddModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-asap-blue text-white rounded-lg hover:bg-asap-blue-dark"
        >
          <Plus className="w-4 h-4" />
          Add Personal Link
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search links..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-asap-blue"
          />
        </div>
        
        <div className="flex gap-2">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeCategory === cat.id
                  ? 'bg-asap-blue text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat.label} ({cat.count})
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-asap-blue/30 border-t-asap-blue rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Personal Links Section */}
          {personalLinks.length > 0 && activeCategory === 'all' && (
            <div>
              <h2 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-500" />
                My Personal Links
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {personalLinks.filter(l => 
                  !searchTerm || l.name.toLowerCase().includes(searchTerm.toLowerCase())
                ).map(link => (
                  <LinkCard 
                    key={link.id} 
                    link={link} 
                    isPersonal={true}
                    onEdit={() => { setEditingLink(link); setShowAddModal(true); }}
                    onDelete={() => deleteLink(link.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Filters */}
          {(activeCategory === 'all' || activeCategory === 'filter') && groupedLinks.filter.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <Filter className="w-5 h-5 text-blue-500" />
                Pipedrive Filters
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {groupedLinks.filter.map(link => (
                  <LinkCard key={link.id} link={link} />
                ))}
              </div>
            </div>
          )}

          {/* Documents */}
          {(activeCategory === 'all' || activeCategory === 'document') && groupedLinks.document.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-500" />
                Documents & Guides
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {groupedLinks.document.map(link => (
                  <LinkCard key={link.id} link={link} />
                ))}
              </div>
            </div>
          )}

          {/* Tools */}
          {(activeCategory === 'all' || activeCategory === 'tool') && groupedLinks.tool.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <LayoutDashboard className="w-5 h-5 text-green-500" />
                Tools & Dashboards
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {groupedLinks.tool.map(link => (
                  <LinkCard key={link.id} link={link} />
                ))}
              </div>
            </div>
          )}

          {/* Forms */}
          {(activeCategory === 'all' || activeCategory === 'form') && groupedLinks.form.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-orange-500" />
                Forms
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {groupedLinks.form.map(link => (
                  <LinkCard key={link.id} link={link} />
                ))}
              </div>
            </div>
          )}

          {filteredLinks.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <LinkIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No links found</p>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <LinkModal
          link={editingLink}
          onSave={saveLink}
          onClose={() => { setShowAddModal(false); setEditingLink(null); }}
        />
      )}
    </div>
  );
}

function LinkCard({ link, isPersonal, onEdit, onDelete }) {
  const colors = categoryColors[link.category] || categoryColors.filter;
  const IconComponent = iconMap[link.icon] || LinkIcon;

  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`group block p-4 rounded-xl border ${colors.border} ${colors.bg} hover:shadow-md transition-all`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-white shadow-sm ${colors.icon}`}>
            <IconComponent className="w-5 h-5" />
          </div>
          <div>
            <h3 className={`font-medium ${colors.text} group-hover:underline`}>
              {link.name}
            </h3>
            <p className="text-xs text-slate-500 capitalize">{link.category}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          {isPersonal && (
            <>
              <button
                onClick={(e) => { e.preventDefault(); onEdit(); }}
                className="p-1.5 hover:bg-white rounded text-slate-400 hover:text-asap-blue"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => { e.preventDefault(); onDelete(); }}
                className="p-1.5 hover:bg-white rounded text-slate-400 hover:text-red-500"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
          <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
        </div>
      </div>
    </a>
  );
}

function LinkModal({ link, onSave, onClose }) {
  const [formData, setFormData] = useState({
    name: link?.name || '',
    url: link?.url || '',
    category: link?.category || 'filter',
    icon: link?.icon || 'link',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.url.trim()) return;
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">
            {link ? 'Edit Link' : 'Add Personal Link'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-asap-blue"
              placeholder="My Filter"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">URL</label>
            <input
              type="url"
              value={formData.url}
              onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-asap-blue"
              placeholder="https://..."
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-asap-blue"
            >
              <option value="filter">Filter</option>
              <option value="document">Document</option>
              <option value="tool">Tool</option>
              <option value="form">Form</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-asap-blue text-white rounded-lg hover:bg-asap-blue-dark flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {link ? 'Update' : 'Add Link'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default QuickLinks;
