import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import {
  Plus,
  MoreVertical,
  Calendar,
  User,
  Users,
  AlertTriangle,
  Flag,
  GripVertical,
  X,
  Edit3,
  Trash2,
  List,
  LayoutGrid,
  ChevronDown,
  Clock,
  Target,
  FileText,
  CheckCircle,
  Pause,
  AlertCircle,
  Save,
  Search,
  Filter,
  SortAsc,
} from 'lucide-react';
import { format, isPast, isToday, differenceInDays } from 'date-fns';
import { supabase } from '../lib/supabase';

const SUPABASE_URL = 'https://kkcbpqbcpzcarxhknzza.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0';

const priorityColors = {
  low: { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-300' },
  medium: { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-300' },
  high: { bg: 'bg-orange-100', text: 'text-orange-600', border: 'border-orange-300' },
  urgent: { bg: 'bg-red-100', text: 'text-red-600', border: 'border-red-300' },
};

const priorityLabels = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

function LeadershipProjects() {
  const { currentUser, supabaseFetch } = useApp();
  const [view, setView] = useState('board'); // 'board' or 'list'
  const [stages, setStages] = useState([]);
  const [cards, setCards] = useState([]);
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draggedCard, setDraggedCard] = useState(null);
  
  // Modal states
  const [showCardModal, setShowCardModal] = useState(false);
  const [editingCard, setEditingCard] = useState(null);
  const [showStageModal, setShowStageModal] = useState(false);
  const [editingStage, setEditingStage] = useState(null);
  const [openProjectId, setOpenProjectId] = useState(null); // full-page project view (Joe 8/11)
  const [aiOpen, setAiOpen] = useState(false); // PHASE A: Create-with-AI interview panel
  
  // Filters
  const [filterOwner, setFilterOwner] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Check if user is leadership
  const isLeadership = currentUser?.department === 'leadership' || currentUser?.role === 'admin';

  useEffect(() => {
    if (isLeadership) {
      loadData();
    }
  }, [isLeadership]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load stages
      const stagesData = await supabaseFetch('project_stages', 'order=position.asc');
      setStages(stagesData || []);

      // Load cards with members
      const cardsData = await supabaseFetch('project_cards', 'order=position.asc');
      setCards(cardsData || []);

      // Load leadership users for owner dropdown
      const usersData = await supabaseFetch('users', 'or=(department.eq.leadership,role.eq.admin)');
      setLeaders(usersData || []);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const apiCall = async (table, method, body, query = '') => {
    const url = `${SUPABASE_URL}/rest/v1/${table}${query ? `?${query}` : ''}`;
    const response = await fetch(url, {
      method,
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': method === 'POST' ? 'return=representation' : 'return=minimal'
      },
      body: body ? JSON.stringify(body) : undefined
    });
    if (method === 'POST' && response.ok) {
      return response.json();
    }
    return response.ok;
  };

  // Drag and drop handlers
  const handleDragStart = (e, card) => {
    setDraggedCard(card);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, targetStageId) => {
    e.preventDefault();
    if (!draggedCard || draggedCard.stage_id === targetStageId) {
      setDraggedCard(null);
      return;
    }

    // Update card stage
    await apiCall('project_cards', 'PATCH', 
      { stage_id: targetStageId, updated_at: new Date().toISOString() },
      `id=eq.${draggedCard.id}`
    );

    // Log activity
    await apiCall('project_card_activity', 'POST', {
      card_id: draggedCard.id,
      user_id: currentUser.id,
      user_name: currentUser.name,
      action: 'moved',
      details: `Moved to ${stages.find(s => s.id === targetStageId)?.name}`
    });

    setDraggedCard(null);
    loadData();
  };

  // Card CRUD
  const saveCard = async (cardData) => {
    try {
      if (editingCard?.id) {
        await apiCall('project_cards', 'PATCH', 
          { ...cardData, updated_at: new Date().toISOString() },
          `id=eq.${editingCard.id}`
        );
      } else {
        const maxPosition = Math.max(...cards.filter(c => c.stage_id === cardData.stage_id).map(c => c.position), -1);
        await apiCall('project_cards', 'POST', {
          ...cardData,
          position: maxPosition + 1,
          created_by: currentUser.id
        });
      }
      setShowCardModal(false);
      setEditingCard(null);
      loadData();
    } catch (err) {
      console.error('Error saving card:', err);
    }
  };

  const deleteCard = async (cardId) => {
    if (!confirm('Delete this project? This cannot be undone.')) return;
    await apiCall('project_cards', 'DELETE', null, `id=eq.${cardId}`);
    loadData();
  };

  // Stage CRUD
  const saveStage = async (stageData) => {
    try {
      if (editingStage?.id) {
        await apiCall('project_stages', 'PATCH', stageData, `id=eq.${editingStage.id}`);
      } else {
        const maxPosition = Math.max(...stages.map(s => s.position), -1);
        await apiCall('project_stages', 'POST', { ...stageData, position: maxPosition + 1 });
      }
      setShowStageModal(false);
      setEditingStage(null);
      loadData();
    } catch (err) {
      console.error('Error saving stage:', err);
    }
  };

  const deleteStage = async (stageId) => {
    const cardsInStage = cards.filter(c => c.stage_id === stageId);
    if (cardsInStage.length > 0) {
      alert('Cannot delete stage with cards. Move or delete cards first.');
      return;
    }
    if (!confirm('Delete this stage?')) return;
    await apiCall('project_stages', 'DELETE', null, `id=eq.${stageId}`);
    loadData();
  };

  // Filter cards
  const filteredCards = cards.filter(card => {
    if (filterOwner !== 'all' && card.owner_id !== filterOwner) return false;
    if (filterPriority !== 'all' && card.priority !== filterPriority) return false;
    if (searchTerm && !card.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  if (!isLeadership) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 text-yellow-700 p-4 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          <span>This page is only available to leadership.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Project Management</h1>
          <p className="text-slate-500 text-sm">Leadership only • Active initiatives & tracking</p>
        </div>
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setView('board')}
              className={`px-3 py-1.5 rounded-md flex items-center gap-2 text-sm font-medium transition-colors ${
                view === 'board' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              Board
            </button>
            <button
              onClick={() => setView('list')}
              className={`px-3 py-1.5 rounded-md flex items-center gap-2 text-sm font-medium transition-colors ${
                view === 'list' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <List className="w-4 h-4" />
              List
            </button>
          </div>
          
          <button
            onClick={() => setAiOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-asap-blue text-white rounded-lg hover:opacity-90 font-medium"
          >
            {'\u2728'} Create with AI
          </button>
          <button
            onClick={() => { setEditingCard(null); setShowCardModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-asap-blue text-white rounded-lg hover:bg-asap-blue-dark font-medium"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-asap-blue"
          />
        </div>
        
        <select
          value={filterOwner}
          onChange={(e) => setFilterOwner(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-asap-blue"
        >
          <option value="all">All Owners</option>
          {leaders.map(l => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
        
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-asap-blue"
        >
          <option value="all">All Priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <button
          onClick={() => setShowStageModal(true)}
          className="text-sm text-slate-500 hover:text-asap-blue flex items-center gap-1"
        >
          <Edit3 className="w-4 h-4" />
          Manage Stages
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-asap-blue/30 border-t-asap-blue rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-500">Loading projects...</p>
          </div>
        </div>
      ) : view === 'board' ? (
        /* Kanban Board View */
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-4 h-full min-w-max pb-4">
            {stages.map(stage => {
              const stageCards = filteredCards.filter(c => c.stage_id === stage.id);
              return (
                <div
                  key={stage.id}
                  className="w-80 flex-shrink-0 bg-slate-100 rounded-xl flex flex-col"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, stage.id)}
                >
                  {/* Stage Header */}
                  <div className="p-3 border-b border-slate-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                        <h3 className="font-semibold text-slate-800">{stage.name}</h3>
                        <span className="text-sm text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
                          {stageCards.length}
                        </span>
                      </div>
                      <button
                        onClick={() => { setEditingStage(stage); setShowStageModal(true); }}
                        className="p-1 hover:bg-slate-200 rounded"
                      >
                        <MoreVertical className="w-4 h-4 text-slate-400" />
                      </button>
                    </div>
                  </div>

                  {/* Cards */}
                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {stageCards.map(card => (
                      <ProjectCard
                        key={card.id}
                        card={card}
                        onDragStart={handleDragStart}
                        onEdit={() => setOpenProjectId(card.id)}
                        onDelete={() => deleteCard(card.id)}
                      />
                    ))}
                    
                    {stageCards.length === 0 && (
                      <div className="text-center py-8 text-slate-400 text-sm">
                        No projects
                      </div>
                    )}
                  </div>

                  {/* Add Card Button */}
                  <button
                    onClick={() => { 
                      setEditingCard({ stage_id: stage.id }); 
                      setShowCardModal(true); 
                    }}
                    className="m-2 p-2 flex items-center justify-center gap-2 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="text-sm">Add project</span>
                  </button>
                </div>
              );
            })}

            {/* Add Stage Button */}
            <button
              onClick={() => { setEditingStage(null); setShowStageModal(true); }}
              className="w-80 flex-shrink-0 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center gap-2 text-slate-500 hover:text-slate-700 hover:border-slate-400 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Stage
            </button>
          </div>
        </div>
      ) : (
        /* List View */
        <div className="flex-1 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Project</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Owner</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Stage</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Priority</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Due Date</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCards.map(card => {
                  const stage = stages.find(s => s.id === card.stage_id);
                  const isOverdue = card.due_date && isPast(new Date(card.due_date)) && !isToday(new Date(card.due_date));
                  
                  return (
                    <tr key={card.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{card.title}</p>
                        {card.objective && (
                          <p className="text-sm text-slate-500 truncate max-w-xs">{card.objective}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{card.owner_name || '-'}</td>
                      <td className="px-4 py-3">
                        <span 
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium"
                          style={{ backgroundColor: `${stage?.color}20`, color: stage?.color }}
                        >
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: stage?.color }} />
                          {stage?.name}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${priorityColors[card.priority]?.bg} ${priorityColors[card.priority]?.text}`}>
                          {priorityLabels[card.priority]}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-slate-600'}`}>
                        {card.due_date ? format(new Date(card.due_date), 'MMM d, yyyy') : '-'}
                        {isOverdue && <span className="ml-1">⚠️</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setOpenProjectId(card.id)}
                            className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-asap-blue"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteCard(card.id)}
                            className="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            
            {filteredCards.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No projects found</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Card Modal */}
      {showCardModal && (
        <CardModal
          card={editingCard}
          stages={stages}
          leaders={leaders}
          currentUser={currentUser}
          onSave={saveCard}
          onClose={() => { setShowCardModal(false); setEditingCard(null); }}
        />
      )}

      {openProjectId && (() => { const pc = cards.find(c => c.id === openProjectId); return pc ? (
        <ProjectDetail key={pc.updated_at || pc.id} card={pc} stages={stages} leaders={leaders} currentUser={currentUser} onReload={() => loadData()}
          onClose={() => setOpenProjectId(null)}
          onDelete={() => { deleteCard(pc.id); setOpenProjectId(null); }}
          onSaveSteps={async (steps) => {
            setCards(prev => prev.map(c => c.id === pc.id ? { ...c, steps } : c));
            await apiCall('project_cards', 'PATCH', { steps, updated_at: new Date().toISOString() }, `id=eq.${pc.id}`);
          }}
          onSaveMeta={async (patch) => {
            setCards(prev => prev.map(c => c.id === pc.id ? { ...c, ...patch } : c));
            await apiCall('project_cards', 'PATCH', { ...patch, updated_at: new Date().toISOString() }, `id=eq.${pc.id}`);
          }}
        />
      ) : null; })()}

      {aiOpen && <AIPlannerPanel onClose={() => setAiOpen(false)} onCreated={() => loadData()} />}

      {/* Stage Modal */}
      {showStageModal && (
        <StageModal
          stage={editingStage}
          stages={stages}
          onSave={saveStage}
          onDelete={editingStage ? () => { deleteStage(editingStage.id); setShowStageModal(false); } : null}
          onClose={() => { setShowStageModal(false); setEditingStage(null); }}
        />
      )}
    </div>
  );
}

// Project Card Component
function ProjectCard({ card, onDragStart, onEdit, onDelete }) {
  const isOverdue = card.due_date && isPast(new Date(card.due_date)) && !isToday(new Date(card.due_date));
  const daysUntilDue = card.due_date ? differenceInDays(new Date(card.due_date), new Date()) : null;
  
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, card)}
      className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-medium text-slate-800 flex-1">{card.title}</h4>
        <div className="flex items-center gap-1">
          <button onClick={onEdit} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-asap-blue">
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete} className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-600">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      
      {card.objective && (
        <p className="text-sm text-slate-500 mb-3 line-clamp-2">{card.objective}</p>
      )}

      {/* Priority & Due Date */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${priorityColors[card.priority]?.bg} ${priorityColors[card.priority]?.text}`}>
          {priorityLabels[card.priority]}
        </span>
        
        {card.due_date && (
          <span className={`flex items-center gap-1 text-xs ${isOverdue ? 'text-red-600 font-medium' : 'text-slate-500'}`}>
            <Calendar className="w-3 h-3" />
            {format(new Date(card.due_date), 'MMM d')}
            {isOverdue && <AlertTriangle className="w-3 h-3" />}
          </span>
        )}
      </div>

      {/* Owner */}
      {card.owner_name && (
        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-100">
          <div className="w-6 h-6 bg-asap-blue rounded-full flex items-center justify-center text-white text-xs font-medium">
            {card.owner_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          <span className="text-xs text-slate-600">{card.owner_name}</span>
        </div>
      )}

      {/* Blocked/Risk indicator */}
      {card.risks && (
        <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-700 flex items-start gap-1">
          <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
          <span className="line-clamp-2">{card.risks}</span>
        </div>
      )}
    </div>
  );
}

// Card Modal Component

// Full-page project view v2 (Joe 8/11): EVERYTHING edits inline on the page - no popup.
// Sections: header (all fields click-to-edit, autosave) / status & plan / UPDATES log /
// SOP & FILES links / TASKS spreadsheet grouped by month. Start-to-finish launch view.
// PHASE A - AI Project Manager interview panel (Joe 8/11): leadership describes a
// project in plain language; the AI asks questions, summarizes, and on approval
// creates the fully structured project card itself.
function AIPlannerPanel({ onClose, onCreated }) {
  const GREETING = { role: 'assistant', local: true, content: "Tell me about the project you want to build - what should it do, and why? I'll ask questions until I have everything, show you a summary, and once you approve it I'll create the whole project with phases, tasks, owners, and dates." };
  const [msgs, setMsgs] = useState([GREETING]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(null);
  const endRef = React.useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, busy]);
  const pollStatus = async (nonce, tries) => {
    if (tries > 80) { setMsgs(p => [...p, { role: 'assistant', content: 'The build is taking unusually long - check the board in a minute, or approve again.' }]); return; }
    await new Promise(rs => setTimeout(rs, 3000));
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess && sess.session && sess.session.access_token;
      const res = await fetch('/.netlify/functions/ai-project-planner', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'status', nonce })
      });
      const j = await res.json();
      if (j.status === 'done' && j.created) {
        setCreated(j.created); onCreated();
        setMsgs(p => [...p, { role: 'assistant', content: `Done - "${j.created.title}" is on the board with ${j.created.tasks} tasks${j.created.due ? `, due ${j.created.due}` : ''}.` }]);
        return;
      }
      if (j.status === 'error') { setMsgs(p => [...p, { role: 'assistant', content: `Build failed: ${j.error}. Say "yes, create it" to try again.` }]); return; }
    } catch (e) { /* transient - keep polling */ }
    pollStatus(nonce, tries + 1);
  };
  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const next = [...msgs, { role: 'user', content: text }];
    setMsgs(next); setInput(''); setBusy(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess && sess.session && sess.session.access_token;
      const res = await fetch('/.netlify/functions/ai-project-planner', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: next.filter(m => !m.local).map(m => ({ role: m.role, content: m.content })) })
      });
      const j = await res.json();
      if (!res.ok) { setMsgs(p => [...p, { role: 'assistant', content: `Error: ${j.error || res.status}` }]); }
      else {
        setMsgs(p => [...p, { role: 'assistant', content: j.reply || '(no reply)' }]);
        if (j.created) { setCreated(j.created); onCreated(); }
        if (j.creating && j.nonce) pollStatus(j.nonce, 0);
      }
    } catch (e) { setMsgs(p => [...p, { role: 'assistant', content: `Error: ${e.message}` }]); }
    setBusy(false);
  };
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl h-[85vh] flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-violet-600 to-asap-blue text-white">
          <div className="font-bold">{'\u2728'} AI Project Manager</div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
          {msgs.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-asap-blue text-white' : 'bg-white border border-slate-200 text-slate-700'}`}>{m.content}</div>
            </div>
          ))}
          {busy && <div className="flex justify-start"><div className="bg-white border border-slate-200 rounded-2xl px-4 py-2.5 text-sm text-slate-400">thinking{'\u2026'}</div></div>}
          {created && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-800">
              <b>{'\u2705'} Project created:</b> {created.title} - {created.tasks} tasks{created.due ? `, due ${created.due}` : ''}. It's on the board now.
            </div>
          )}
          <div ref={endRef} />
        </div>
        <div className="p-3 border-t border-slate-200 flex gap-2 bg-white">
          <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={2}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={created ? 'Project created - close this panel, or describe another project' : 'Describe the project... (Enter to send, Shift+Enter for a new line)'}
            className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-asap-blue resize-none" />
          <button onClick={send} disabled={busy} className="px-5 bg-asap-blue text-white rounded-xl font-medium hover:bg-asap-blue-dark disabled:opacity-50">Send</button>
        </div>
      </div>
    </div>
  );
}

// PHASE B - per-project AI assistant (Joe 8/11): the same brain pointed at an
// existing card. "Push testing out two days" / "add a task for X" / "mark layout
// done" - it edits the card server-side and the page reloads with the changes.
function ProjectAIPanel({ card, onClose, onChanged }) {
  const [msgs, setMsgs] = useState([{ role: 'assistant', local: true, content: `I'm managing "${card.title}" with you. Ask me anything about it, or tell me what to change - dates, tasks, subtasks, phases, updates - and I'll do it.` }]);
  // PHASE C (Joe 8/13): in-Playbook SOP engine - generate from the card, review, approve.
  const [sopBusy, setSopBusy] = useState(false);
  const [sopDraft, setSopDraft] = useState(null);
  const genSOP = async () => {
    if (sopBusy) return; setSopBusy(true);
    setMsgs(p => [...p, { role: 'assistant', local: true, content: 'Drafting the SOP from this project card - 30 to 60 seconds...' }]);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess && sess.session && sess.session.access_token;
      const st = await fetch('/.netlify/functions/ai-sop', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ action: 'start', card_id: card.id }) });
      const sj = await st.json();
      if (!st.ok || !sj.nonce) throw new Error(sj.error || 'start failed');
      for (let t = 0; t < 100; t++) {
        await new Promise(r => setTimeout(r, 3000));
        const pr = await fetch('/.netlify/functions/ai-sop', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ action: 'status', nonce: sj.nonce }) });
        const pj = await pr.json();
        if (pj.status === 'done') { setSopDraft(pj.draft || ''); setSopBusy(false); return; }
        if (pj.status === 'error') throw new Error(pj.error || 'generation failed');
      }
      throw new Error('timed out waiting for the draft');
    } catch (e) { setMsgs(p => [...p, { role: 'assistant', local: true, content: 'SOP draft failed: ' + e.message }]); setSopBusy(false); }
  };
  const approveSOP = async () => {
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess && sess.session && sess.session.access_token;
      const res = await fetch('/.netlify/functions/ai-sop', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ action: 'approve', card_id: card.id, content: sopDraft }) });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || 'approve failed');
      setSopDraft(null);
      setMsgs(p => [...p, { role: 'assistant', local: true, content: 'SOP v' + j.version + ' approved and attached to this project.' }]);
      setTimeout(() => onChanged(), 800);
    } catch (e) { setMsgs(p => [...p, { role: 'assistant', local: true, content: 'SOP approve failed: ' + e.message }]); }
  };
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = React.useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, busy]);
  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const next = [...msgs, { role: 'user', content: text }];
    setMsgs(next); setInput(''); setBusy(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess && sess.session && sess.session.access_token;
      const res = await fetch('/.netlify/functions/ai-project-assistant', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ card_id: card.id, messages: next.filter(m => !m.local).map(m => ({ role: m.role, content: m.content })) })
      });
      const j = await res.json();
      if (!res.ok) setMsgs(p => [...p, { role: 'assistant', content: `Error: ${j.error || res.status}` }]);
      else {
        setMsgs(p => [...p, { role: 'assistant', content: (j.reply || '(no reply)') + (j.applied ? `\n\n(${j.applied} change${j.applied === 1 ? '' : 's'} applied - refreshing the page data now)` : '') }]);
        if (j.applied) setTimeout(() => onChanged(), 800);
      }
    } catch (e) { setMsgs(p => [...p, { role: 'assistant', content: `Error: ${e.message}` }]); }
    setBusy(false);
  };
  return (
    <div className="fixed right-6 bottom-6 z-50 w-[26rem] max-w-[92vw] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden" style={{ height: '32rem' }}>
      <div className="px-4 py-3 flex items-center justify-between bg-gradient-to-r from-violet-600 to-asap-blue text-white">
        <div className="font-bold text-sm">{'\u2728'} AI Project Manager</div>
        <button onClick={genSOP} disabled={sopBusy} className="ml-auto mr-2 px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-semibold disabled:opacity-50">{sopBusy ? 'Drafting...' : 'Generate SOP'}</button>
        {sopDraft !== null && (
          <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col" style={{ height: '85vh' }}>
              <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
                <div className="font-bold text-slate-800">SOP draft - review, edit, approve</div>
                <button onClick={() => setSopDraft(null)} className="text-slate-400 hover:text-slate-600 text-lg leading-none">X</button>
              </div>
              <textarea value={sopDraft} onChange={(e) => setSopDraft(e.target.value)}
                className="flex-1 m-4 border border-slate-200 rounded-xl p-4 text-xs font-mono text-slate-700 focus:outline-none focus:border-asap-blue resize-none" />
              <div className="px-5 pb-4 flex gap-2 justify-end">
                <button onClick={() => setSopDraft(null)} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Discard</button>
                <button onClick={approveSOP} className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700">Approve and Attach</button>
              </div>
            </div>
          </div>
        )}
        <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg"><X className="w-4 h-4" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[90%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-asap-blue text-white' : 'bg-white border border-slate-200 text-slate-700'}`}>{m.content}</div>
          </div>
        ))}
        {busy && <div className="flex justify-start"><div className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-400">working{'\u2026'}</div></div>}
        <div ref={endRef} />
      </div>
      <div className="p-2.5 border-t border-slate-200 flex gap-2 bg-white">
        <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={2}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Ask or instruct... (Enter to send)"
          className="flex-1 border border-slate-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-asap-blue resize-none" />
        <button onClick={send} disabled={busy} className="px-4 bg-asap-blue text-white rounded-xl text-sm font-medium hover:bg-asap-blue-dark disabled:opacity-50">Send</button>
      </div>
    </div>
  );
}

function ProjectDetail({ card, stages, leaders, currentUser, onClose, onDelete, onSaveSteps, onSaveMeta, onReload }) {
  const [steps, setSteps] = useState(Array.isArray(card.steps) ? card.steps : []);
  const [meta, setMeta] = useState({ title: card.title || '', objective: card.objective || '', notes: card.notes || '',
    dependencies: card.dependencies || '', risks: card.risks || '', owner_name: card.owner_name || '',
    priority: card.priority || 'medium', stage_id: card.stage_id, target_start_date: card.target_start_date || '', due_date: card.due_date || '' });
  const [updates, setUpdates] = useState(Array.isArray(card.updates) ? card.updates : []);
  const [aiPanel, setAiPanel] = useState(false); // PHASE B assistant
  const phase = card.phase || 'PREPLAN';
  const PHASES = ['PREPLAN','LAYOUT','BUILD','TESTING','SOP','LAUNCH','TRAINING','TRACKING'];
  const [links, setLinks] = useState(Array.isArray(card.links) ? card.links : []);
  const [newUpdate, setNewUpdate] = useState('');
  const [newLink, setNewLink] = useState({ label: '', url: '' });
  const [newTask, setNewTask] = useState({ text: '', assignee: '', due: '' });
  const [expanded, setExpanded] = useState(null); // which task row is open (Joe 8/11: tasks open up - subtasks, instructions, test links)
  const [newSub, setNewSub] = useState('');
  const addSub = (i) => { const t = newSub.trim(); if (!t) return; setField(i, 'subtasks', [...(steps[i].subtasks || []), { text: t, done: false }]); setNewSub(''); };
  const toggleSub = (i, j) => setField(i, 'subtasks', (steps[i].subtasks || []).map((sb, k) => k === j ? { ...sb, done: !sb.done, done_by: !sb.done ? (currentUser?.name || '') : null } : sb));
  const removeSub = (i, j) => setField(i, 'subtasks', (steps[i].subtasks || []).filter((_, k) => k !== j));
  const todayStr = new Date().toISOString().slice(0, 10);
  const doneCount = steps.filter(st => st.done).length;
  const pct = steps.length ? Math.round((doneCount / steps.length) * 100) : 0;
  const stage = stages.find(st => st.id === meta.stage_id);
  const saveSteps = (next) => { setSteps(next); onSaveSteps(next); };
  const setM = (fld, v) => setMeta(p => ({ ...p, [fld]: v }));
  const commit = (fld) => { if ((card[fld] || '') !== (meta[fld] || '')) onSaveMeta({ [fld]: meta[fld] === '' ? null : meta[fld] }); };
  const commitNow = (fld, v) => { setM(fld, v); onSaveMeta({ [fld]: v === '' ? null : v }); };
  const setField = (i, fld, v) => saveSteps(steps.map((st, j) => j === i ? { ...st, [fld]: v } : st));
  const toggle = (i) => saveSteps(steps.map((st, j) => j === i ? { ...st, done: !st.done, done_by: !st.done ? (currentUser?.name || '') : st.done_by, done_at: !st.done ? new Date().toISOString() : null } : st));
  const removeTask = (i) => { if (confirm('Remove this task?')) saveSteps(steps.filter((_, j) => j !== i)); };
  const addTask = () => { const t = newTask.text.trim(); if (!t) return;
    saveSteps([...steps, { text: t, assignee: newTask.assignee || '', due: newTask.due || '', done: false }]);
    setNewTask({ text: '', assignee: '', due: '' }); };
  const addUpdate = () => { const t = newUpdate.trim(); if (!t) return;
    const next = [{ text: t, by: currentUser?.name || 'Unknown', at: new Date().toISOString() }, ...updates];
    setUpdates(next); onSaveMeta({ updates: next }); setNewUpdate(''); };
  const removeUpdate = (i) => { if (!confirm('Remove this update?')) return;
    const next = updates.filter((_, j) => j !== i); setUpdates(next); onSaveMeta({ updates: next }); };
  const addLink = () => { const u = newLink.url.trim(); if (!u) return;
    const next = [...links, { label: newLink.label.trim() || u, url: u.startsWith('http') ? u : 'https://' + u }];
    setLinks(next); onSaveMeta({ links: next }); setNewLink({ label: '', url: '' }); };
  const removeLink = (i) => { const next = links.filter((_, j) => j !== i); setLinks(next); onSaveMeta({ links: next }); };
  const chip = (st) => {
    if (st.done) return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">Done{st.done_by ? ` - ${String(st.done_by).split(' ')[0]}` : ''}</span>;
    if (st.due && st.due < todayStr) return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700">Overdue</span>;
    if (st.due && st.due <= new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)) return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">Due soon</span>;
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500">Upcoming</span>;
  };
  const monthOf = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'No date set';
  const fmtWhen = (iso) => { try { return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch (e) { return ''; } };
  const inputCls = "bg-transparent border border-transparent hover:border-slate-200 focus:border-asap-blue rounded px-2 py-1 focus:outline-none";
  return (
    <div className="fixed inset-0 bg-slate-50 z-40 overflow-y-auto">
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <button onClick={onClose} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-medium"><X className="w-5 h-5" /> Back to board</button>
          <div className="flex items-center gap-2">
            <button onClick={() => setAiPanel(true)} className="flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-violet-600 to-asap-blue text-white rounded-lg hover:opacity-90 text-sm font-medium">{'\u2728'} AI Project Manager</button>
            <button onClick={onDelete} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg hover:bg-rose-50 text-sm font-medium text-rose-600"><Trash2 className="w-4 h-4" /> Delete project</button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-4">
          <input value={meta.title} onChange={(e) => setM('title', e.target.value)} onBlur={() => commit('title')}
            className="text-2xl font-bold text-slate-800 w-full bg-transparent border-b-2 border-transparent hover:border-slate-200 focus:border-asap-blue focus:outline-none mb-3" />
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-600 mb-3">
            <label className="flex items-center gap-1.5">Stage:
              <select value={meta.stage_id || ''} onChange={(e) => commitNow('stage_id', e.target.value)} className={inputCls + ' font-semibold'} style={{ color: stage?.color }}>
                {stages.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
              </select></label>
            <label className="flex items-center gap-1.5">Priority:
              <select value={meta.priority} onChange={(e) => commitNow('priority', e.target.value)} className={inputCls + ' font-semibold capitalize'}>
                <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
              </select></label>
            <label className="flex items-center gap-1.5"><User className="w-4 h-4 text-slate-400" /> Owner:
              <input type="text" list="pd-assignees" value={meta.owner_name} onChange={(e) => setM('owner_name', e.target.value)} onBlur={() => commit('owner_name')} className={inputCls + ' w-36 font-semibold'} /></label>
            <label className="flex items-center gap-1.5"><Calendar className="w-4 h-4 text-slate-400" /> Start:
              <input type="date" value={meta.target_start_date || ''} onChange={(e) => commitNow('target_start_date', e.target.value)} className={inputCls} /></label>
            <label className="flex items-center gap-1.5"><Flag className="w-4 h-4 text-slate-400" /> Deadline:
              <input type="date" value={meta.due_date || ''} onChange={(e) => commitNow('due_date', e.target.value)} className={inputCls + (meta.due_date && meta.due_date < todayStr ? ' text-rose-600 font-semibold' : '')} /></label>
            <span className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-slate-400" /> <b>{doneCount}/{steps.length}</b> done</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2.5 mb-4">
            <div className="bg-asap-blue h-2.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1">
            {PHASES.map((ph, i) => {
              const cur = PHASES.indexOf(phase);
              const state = i < cur ? 'past' : i === cur ? 'current' : 'future';
              return (
                <React.Fragment key={ph}>
                  {i > 0 && <div className={`h-0.5 w-3 shrink-0 ${state === 'future' ? 'bg-slate-200' : 'bg-asap-blue'}`} />}
                  <button onClick={() => onSaveMeta({ phase: ph })}
                    title={state === 'current' ? 'Current phase' : `Set phase to ${ph}`}
                    className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide transition-all ${state === 'current' ? 'bg-asap-blue text-white shadow' : state === 'past' ? 'bg-blue-50 text-asap-blue' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
                    {state === 'past' ? '\u2713 ' : ''}{ph}
                  </button>
                </React.Fragment>
              );
            })}
          </div>
          {aiPanel && <ProjectAIPanel card={card} onClose={() => setAiPanel(false)} onChanged={() => { setAiPanel(false); onReload(); }} />}
          <div className="text-xs font-bold text-slate-400 uppercase mb-1">Objective</div>
          <textarea value={meta.objective} onChange={(e) => setM('objective', e.target.value)} onBlur={() => commit('objective')} rows={2}
            placeholder="What does done look like?" className="w-full text-slate-700 bg-transparent border border-transparent hover:border-slate-200 focus:border-asap-blue rounded-lg p-2 focus:outline-none resize-none mb-3" />
          <div className="text-xs font-bold text-slate-400 uppercase mb-1">Status &amp; Plan</div>
          <textarea value={meta.notes} onChange={(e) => setM('notes', e.target.value)} onBlur={() => commit('notes')} rows={10}
            placeholder="Where we are, what's next, deadline table..." className="w-full text-sm text-slate-600 bg-slate-50 border border-slate-100 hover:border-slate-200 focus:border-asap-blue rounded-xl p-4 focus:outline-none" />
          <div className="grid md:grid-cols-2 gap-3 mt-3 text-sm">
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
              <b className="text-amber-800">Dependencies</b>
              <textarea value={meta.dependencies} onChange={(e) => setM('dependencies', e.target.value)} onBlur={() => commit('dependencies')} rows={2}
                className="w-full bg-transparent text-amber-900 focus:outline-none resize-none mt-1" placeholder="What this waits on..." />
            </div>
            <div className="bg-rose-50 border border-rose-100 rounded-xl p-3">
              <b className="text-rose-800">Risks</b>
              <textarea value={meta.risks} onChange={(e) => setM('risks', e.target.value)} onBlur={() => commit('risks')} rows={2}
                className="w-full bg-transparent text-rose-900 focus:outline-none resize-none mt-1" placeholder="What could go wrong..." />
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <h2 className="font-bold text-slate-800 mb-3">Updates</h2>
            <div className="flex gap-2 mb-3">
              <input type="text" value={newUpdate} onChange={(e) => setNewUpdate(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addUpdate(); } }}
                placeholder="Post an update..." className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-asap-blue" />
              <button onClick={addUpdate} className="px-3 py-2 bg-asap-blue text-white rounded-lg hover:bg-asap-blue-dark text-sm font-medium">Post</button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {updates.length === 0 && <div className="text-sm text-slate-400">No updates yet - post progress notes here so the whole team sees the latest.</div>}
              {updates.map((u, i) => (
                <div key={i} className="group bg-slate-50 rounded-lg p-2.5 text-sm">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-0.5">
                    <span><b className="text-slate-600">{u.by}</b> - {fmtWhen(u.at)}</span>
                    <button onClick={() => removeUpdate(i)} className="opacity-0 group-hover:opacity-100 hover:text-rose-500">{'\u2715'}</button>
                  </div>
                  <div className="text-slate-700 whitespace-pre-wrap">{u.text}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <h2 className="font-bold text-slate-800 mb-3">SOP &amp; Files</h2>
            <div className="flex flex-wrap gap-2 mb-3">
              <input type="text" value={newLink.label} onChange={(e) => setNewLink(p => ({ ...p, label: e.target.value }))}
                placeholder="Name (e.g. SOP v2)" className="w-36 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-asap-blue" />
              <input type="text" value={newLink.url} onChange={(e) => setNewLink(p => ({ ...p, url: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }}
                placeholder="Paste link (Drive, Docs, Loom...)" className="flex-1 min-w-[160px] border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-asap-blue" />
              <button onClick={addLink} className="px-3 py-2 bg-asap-blue text-white rounded-lg hover:bg-asap-blue-dark text-sm font-medium">Add</button>
            </div>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {links.length === 0 && <div className="text-sm text-slate-400">Attach the SOP, training videos, Loom walkthroughs, and any docs - one link each.</div>}
              {links.map((l, i) => (
                <div key={i} className="group flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 text-sm">
                  <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                  {l.sop ? (
                    <details className="flex-1 min-w-0">
                      <summary className="cursor-pointer text-asap-blue hover:underline truncate list-none">{l.label || l.name}{l.approved_by ? ' - approved by ' + l.approved_by : ''}</summary>
                      <pre className="mt-2 max-h-96 overflow-y-auto whitespace-pre-wrap text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-3">{l.content}</pre>
                    </details>
                  ) : (
                    <a href={l.url} target="_blank" rel="noreferrer" className="flex-1 text-asap-blue hover:underline truncate">{l.label}</a>
                  )}
                  <button onClick={() => removeLink(i)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500">{'\u2715'}</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-bold text-slate-800">Tasks &amp; Timeline</h2>
            <span className="text-sm text-slate-500">{doneCount} done - {steps.filter(st => !st.done && st.due && st.due < todayStr).length} overdue - {steps.length - doneCount} open</span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr><th className="w-10 px-3 py-2"></th><th className="text-left px-3 py-2">Task</th><th className="text-left px-3 py-2 w-44">Assignee</th><th className="text-left px-3 py-2 w-36">Due date</th><th className="text-left px-3 py-2 w-32">Status</th><th className="w-10 px-3 py-2"></th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(() => { const els = []; let lastM = null;
                // DATE-ORDER FIX (Joe 8/13): render sorted by due date (undated last, ties keep
                // original order); array order untouched so indices stay stable for edits.
                const ordered = steps.map((st, i) => ({ st, i })).sort((x, y) => {
                  const dx = x.st.due || '9999-12-31', dy = y.st.due || '9999-12-31';
                  return dx < dy ? -1 : dx > dy ? 1 : x.i - y.i;
                });
                ordered.forEach(({ st, i }) => {
                  const m = monthOf(st.due);
                  if (m !== lastM) { lastM = m;
                    els.push(<tr key={`m-${i}`} className="bg-slate-100/70"><td colSpan={6} className="px-4 py-1.5 text-xs font-bold text-slate-500 uppercase tracking-wide">{m}</td></tr>); }
                  const subs = st.subtasks || [];
                  els.push(
                    <tr key={i} className={st.done ? 'bg-slate-50/60' : 'hover:bg-slate-50'}>
                      <td className="px-3 py-2 text-center"><input type="checkbox" checked={!!st.done} onChange={() => toggle(i)} className="w-4 h-4" /></td>
                      <td className={`px-3 py-2 ${st.done ? 'text-slate-400' : 'text-slate-700'}`}>
                        <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => { setExpanded(expanded === i ? null : i); setNewSub(''); }}>
                          <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${expanded === i ? '' : '-rotate-90'}`} />
                          <span className={st.done ? 'line-through' : ''}>{st.text}</span>
                          {subs.length > 0 && <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0">{subs.filter(x => x.done).length}/{subs.length}</span>}
                          {st.test_url && <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-asap-blue shrink-0">test link</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2"><input type="text" list="pd-assignees" value={st.assignee || st.done_by || ''} onChange={(e) => setField(i, 'assignee', e.target.value)} placeholder="Assign..." className={inputCls + ' w-full'} /></td>
                      <td className="px-3 py-2"><input type="date" value={st.due || ''} onChange={(e) => setField(i, 'due', e.target.value)} className={inputCls} /></td>
                      <td className="px-3 py-2">{chip(st)}</td>
                      <td className="px-3 py-2 text-center"><button onClick={() => removeTask(i)} className="text-slate-300 hover:text-rose-500"><Trash2 className="w-4 h-4" /></button></td>
                    </tr>);
                  if (expanded === i) els.push(
                    <tr key={`x-${i}`} className="bg-blue-50/30">
                      <td className="border-l-4 border-asap-blue"></td>
                      <td colSpan={5} className="px-3 py-4">
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <div className="text-xs font-bold text-slate-400 uppercase mb-1">What to do</div>
                            <textarea value={st.details || ''} onChange={(e) => setField(i, 'details', e.target.value)} rows={4}
                              placeholder="Exact instructions - what does doing this task look like, step by step?"
                              className="w-full text-sm border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:border-asap-blue bg-white" />
                            <div className="text-xs font-bold text-slate-400 uppercase mt-3 mb-1">Test link</div>
                            <div className="flex gap-2">
                              <input type="text" value={st.test_url || ''} onChange={(e) => setField(i, 'test_url', e.target.value)}
                                placeholder="https://... (the page to test)"
                                className="flex-1 text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-asap-blue bg-white" />
                              {st.test_url && <a href={st.test_url} target="_blank" rel="noreferrer" className="px-3 py-1.5 bg-asap-blue text-white rounded-lg text-sm font-medium hover:bg-asap-blue-dark">Open</a>}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-400 uppercase mb-1">Subtasks ({subs.filter(x => x.done).length}/{subs.length})</div>
                            <div className="space-y-1 max-h-40 overflow-y-auto">
                              {subs.length === 0 && <div className="text-xs text-slate-400">Break this task down - add subtasks below.</div>}
                              {subs.map((sb, j) => (
                                <div key={j} className="flex items-start gap-2 group bg-white rounded-lg px-2 py-1.5 border border-slate-100">
                                  <input type="checkbox" checked={!!sb.done} onChange={() => toggleSub(i, j)} className="mt-0.5" />
                                  <span className={`flex-1 text-sm ${sb.done ? 'line-through text-slate-400' : 'text-slate-700'}`}>{sb.text}{sb.done && sb.done_by ? <span className="ml-1.5 text-[10px] text-emerald-600">{'\u2713'} {String(sb.done_by).split(' ')[0]}</span> : null}</span>
                                  <button onClick={() => removeSub(i, j)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 text-xs">{'\u2715'}</button>
                                </div>
                              ))}
                            </div>
                            <div className="flex gap-2 mt-2">
                              <input type="text" value={newSub} onChange={(e) => setNewSub(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSub(i); } }}
                                placeholder="Add a subtask and press Enter"
                                className="flex-1 text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-asap-blue bg-white" />
                              <button onClick={() => addSub(i)} className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 rounded-lg text-sm font-medium">Add</button>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>);
                }); return els; })()}
            </tbody>
          </table>
          <datalist id="pd-assignees">
            {leaders.map(l => <option key={l.id} value={l.name} />)}
            <option value="Leadership" /><option value="Astrid + AMs" /><option value="Build (Joe + Claude)" /><option value="Joe + Claude" />
          </datalist>
          <div className="px-6 py-4 border-t border-slate-200 flex flex-wrap gap-2 items-center bg-slate-50">
            <input type="text" value={newTask.text} onChange={(e) => setNewTask(p => ({ ...p, text: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTask(); } }}
              placeholder="Add a task..." className="flex-1 min-w-[220px] border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-asap-blue" />
            <input type="text" list="pd-assignees" value={newTask.assignee} onChange={(e) => setNewTask(p => ({ ...p, assignee: e.target.value }))}
              placeholder="Assignee" className="w-40 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-asap-blue" />
            <input type="date" value={newTask.due} onChange={(e) => setNewTask(p => ({ ...p, due: e.target.value }))}
              className="border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-asap-blue" />
            <button onClick={addTask} className="flex items-center gap-1.5 px-4 py-2 bg-asap-blue text-white rounded-lg hover:bg-asap-blue-dark font-medium"><Plus className="w-4 h-4" /> Add</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CardModal({ card, stages, leaders, currentUser, onSave, onClose }) {
  const [formData, setFormData] = useState({
    title: card?.title || '',
    objective: card?.objective || '',
    stage_id: card?.stage_id || stages[0]?.id,
    owner_id: card?.owner_id || '',
    owner_name: card?.owner_name || '',
    priority: card?.priority || 'medium',
    due_date: card?.due_date || '',
    target_start_date: card?.target_start_date || '',
    dependencies: card?.dependencies || '',
    risks: card?.risks || '',
    notes: card?.notes || '',
    on_hold_reason: card?.on_hold_reason || '',
    revisit_date: card?.revisit_date || '',
    steps: Array.isArray(card?.steps) ? card.steps : [],
  });
  const [newStep, setNewStep] = useState('');
  const toggleStep = (i) => setFormData(prev => ({ ...prev, steps: prev.steps.map((st, j) => j === i ? { ...st, done: !st.done, done_by: !st.done ? (currentUser?.name || '') : null, done_at: !st.done ? new Date().toISOString() : null } : st) }));
  const addStep = () => { const t = newStep.trim(); if (!t) return; setFormData(prev => ({ ...prev, steps: [...prev.steps, { text: t, done: false }] })); setNewStep(''); };
  const removeStep = (i) => setFormData(prev => ({ ...prev, steps: prev.steps.filter((_, j) => j !== i) }));

  const handleOwnerChange = (ownerId) => {
    const owner = leaders.find(l => l.id === ownerId);
    setFormData(prev => ({
      ...prev,
      owner_id: ownerId,
      owner_name: owner?.name || ''
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return;
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800">
            {card?.id ? 'Edit Project' : 'New Project'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Project Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-asap-blue"
              placeholder="Enter project title"
              required
            />
          </div>

          {/* Steps checklist (Joe 8/11: project steps live in the card - leaders tick them off as they test) */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Steps ({formData.steps.filter(st => st.done).length}/{formData.steps.length} done)</label>
            <div className="space-y-1 max-h-56 overflow-y-auto border border-slate-200 rounded-lg p-2">
              {formData.steps.length === 0 && <div className="text-xs text-slate-400 p-1">No steps yet - add the checklist below.</div>}
              {formData.steps.map((st, i) => (
                <div key={i} className="flex items-start gap-2 group">
                  <input type="checkbox" checked={!!st.done} onChange={() => toggleStep(i)} className="mt-1" />
                  <div className={`flex-1 text-sm ${st.done ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                    {st.text}
                    {st.done && st.done_by && <span className="ml-2 text-[10px] text-emerald-600 no-underline">{'\u2713'} {st.done_by}</span>}
                  </div>
                  <button type="button" onClick={() => removeStep(i)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 text-xs">{'\u2715'}</button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <input type="text" value={newStep} onChange={(e) => setNewStep(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addStep(); } }}
                placeholder="Add a step and press Enter"
                className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-asap-blue" />
              <button type="button" onClick={addStep} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium">Add</button>
            </div>
          </div>

          {/* Objective */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Objective / Outcome</label>
            <textarea
              value={formData.objective}
              onChange={(e) => setFormData(prev => ({ ...prev, objective: e.target.value }))}
              rows={2}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-asap-blue resize-none"
              placeholder="What's the goal of this project?"
            />
          </div>

          {/* Stage & Owner Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Stage</label>
              <select
                value={formData.stage_id}
                onChange={(e) => setFormData(prev => ({ ...prev, stage_id: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-asap-blue"
              >
                {stages.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Owner *</label>
              <select
                value={formData.owner_id}
                onChange={(e) => handleOwnerChange(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-asap-blue"
              >
                <option value="">Select owner</option>
                {leaders.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Priority & Dates Row */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-asap-blue"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
              <input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-asap-blue"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Target Start</label>
              <input
                type="date"
                value={formData.target_start_date}
                onChange={(e) => setFormData(prev => ({ ...prev, target_start_date: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-asap-blue"
              />
            </div>
          </div>

          {/* Dependencies & Risks */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Dependencies</label>
              <textarea
                value={formData.dependencies}
                onChange={(e) => setFormData(prev => ({ ...prev, dependencies: e.target.value }))}
                rows={2}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-asap-blue resize-none"
                placeholder="What does this depend on?"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Risks / Blockers</label>
              <textarea
                value={formData.risks}
                onChange={(e) => setFormData(prev => ({ ...prev, risks: e.target.value }))}
                rows={2}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-asap-blue resize-none text-red-600"
                placeholder="Any blockers? Document immediately!"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={2}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-asap-blue resize-none"
              placeholder="Additional notes..."
            />
          </div>

          {/* On Hold Section */}
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
            <h4 className="text-sm font-medium text-amber-800 mb-2">On Hold Details</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-amber-700 mb-1">Reason on Hold</label>
                <input
                  type="text"
                  value={formData.on_hold_reason}
                  onChange={(e) => setFormData(prev => ({ ...prev, on_hold_reason: e.target.value }))}
                  className="w-full border border-amber-200 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-400 text-sm"
                  placeholder="Why is this on hold?"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-amber-700 mb-1">Revisit Date</label>
                <input
                  type="date"
                  value={formData.revisit_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, revisit_date: e.target.value }))}
                  className="w-full border border-amber-200 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-400 text-sm"
                />
              </div>
            </div>
          </div>
        </form>

        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-asap-blue text-white rounded-lg hover:bg-asap-blue-dark flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {card?.id ? 'Update Project' : 'Create Project'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Stage Modal Component
function StageModal({ stage, stages, onSave, onDelete, onClose }) {
  const [name, setName] = useState(stage?.name || '');
  const [color, setColor] = useState(stage?.color || '#3b82f6');

  const colors = [
    '#6b7280', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4'
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name, color });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">
            {stage ? 'Edit Stage' : 'New Stage'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Stage Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-asap-blue"
              placeholder="e.g., In Review"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Color</label>
            <div className="flex gap-2 flex-wrap">
              {colors.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-transform ${
                    color === c ? 'border-slate-800 scale-110' : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-between pt-4">
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            )}
            <div className="flex gap-3 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-asap-blue text-white rounded-lg hover:bg-asap-blue-dark"
              >
                {stage ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default LeadershipProjects;
