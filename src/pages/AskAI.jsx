import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { 
  Sparkles, Search, Copy, Check, AlertCircle,
  Loader, ExternalLink, FileText, ChevronDown, ChevronUp,
  ThumbsUp, ThumbsDown, Phone, Mail, MessageCircle,
  User, Users, UserCheck, RefreshCw, X, Send, Edit2, Plus
} from 'lucide-react';

const SUPABASE_URL = 'https://kkcbpqbcpzcarxhknzza.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0';

// Communication types
const COMMUNICATION_TYPES = [
  { id: 'call', name: 'Phone Call', icon: Phone },
  { id: 'sms', name: 'SMS/Text', icon: MessageCircle },
  { id: 'email', name: 'Email', icon: Mail },
];

// Client situations
const CLIENT_SITUATIONS = [
  { id: 'new_lead', name: 'New Lead', icon: User },
  { id: 'quoted', name: 'Quoted', icon: UserCheck },
  { id: 'current_client', name: 'Current Client', icon: Users },
  { id: 'past_client', name: 'Past Client', icon: RefreshCw },
];

// Search categories
const CATEGORIES = [
  { id: 'all', name: 'All' },
  { id: 'process', name: 'Processes' },
  { id: 'training', name: 'Training' },
  { id: 'scripts', name: 'Scripts' },
  { id: 'objections', name: 'Objections' },
  { id: 'pricing', name: 'Pricing' },
  { id: 'links', name: 'Links' },
  { id: 'faq', name: 'FAQ' },
  { id: 'compliance', name: 'Compliance' },
];

export default function AskAI() {
  const { currentUser } = useApp();
  const [query, setQuery] = useState('');
  const [commType, setCommType] = useState('call');
  const [clientSituation, setClientSituation] = useState('new_lead');
  const [category, setCategory] = useState('all');
  const [knowledgeBase, setKnowledgeBase] = useState([]);
  const [companyProfile, setCompanyProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const [aiResponse, setAiResponse] = useState(null);
  const [currentQuery, setCurrentQuery] = useState('');
  const [relevantDocs, setRelevantDocs] = useState([]);
  const [showDocs, setShowDocs] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  
  // Conversational training state (admin only)
  const [trainingMessages, setTrainingMessages] = useState([]); // { role, content }
  const [trainingInput, setTrainingInput] = useState('');
  const [trainingLoading, setTrainingLoading] = useState(false);
  const [revisedResponse, setRevisedResponse] = useState(null);
  const [kbUpdated, setKbUpdated] = useState(false);

  // Send admin feedback to AI for revision
  const sendTrainingFeedback = async () => {
    if (!trainingInput.trim() || trainingLoading) return;
    
    const feedback = trainingInput.trim();
    setTrainingInput('');
    setTrainingLoading(true);
    setKbUpdated(false);
    
    // Build conversation history
    const newMessages = [
      ...trainingMessages,
      { role: 'user', content: feedback }
    ];
    setTrainingMessages(newMessages);
    
    try {
      const docs = findRelevantDocs(currentQuery);
      const kbContext = docs.map(k => `[${k.category?.toUpperCase()}] ${k.title}:\n${k.content}`).join('\n\n---\n\n');
      
      const res = await fetch('/.netlify/functions/ask-openai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyContext: buildCompanyContext(),
          kbContext: kbContext,
          systemPrompt: `You are being trained by an admin at ASAP Credit Repair. 
The admin asked: "${currentQuery}"
Your original response was: "${aiResponse}"

The admin is now giving you feedback to improve your answer. Apply their corrections and generate a COMPLETE revised response to the original question. 
- Do NOT explain what you changed
- Do NOT say "here's the revised response" 
- Just give the corrected, complete answer as if you're answering the original question fresh
- Apply ALL the admin's feedback from this conversation`,
          messages: [
            { role: 'user', content: currentQuery },
            { role: 'assistant', content: aiResponse },
            ...newMessages.map(m => ({
              role: m.role === 'user' ? 'user' : 'assistant',
              content: m.content
            }))
          ]
        })
      });

      if (!res.ok) throw new Error('AI request failed');
      
      const data = await res.json();
      const revised = data.content || 'No response received.';
      setRevisedResponse(revised);
      setTrainingMessages([...newMessages, { role: 'assistant', content: revised }]);
      
    } catch (err) {
      console.error('Training feedback error:', err);
      setTrainingMessages([...newMessages, { role: 'assistant', content: '⚠️ Error generating revised response. Try again.' }]);
    } finally {
      setTrainingLoading(false);
    }
  };

  // Approve revised response and update KB directly
  const approveAndUpdateKB = async () => {
    if (!revisedResponse) return;
    
    setTrainingLoading(true);
    try {
      // 1. Find if there's an existing KB entry for this topic
      const searchTerms = currentQuery.toLowerCase().split(/\s+/).filter(t => t.length > 3).slice(0, 3).join(' ');
      const existingRes = await fetch(
        `${SUPABASE_URL}/rest/v1/knowledge_base?is_active=eq.true&title=ilike.*${encodeURIComponent(searchTerms.split(' ')[0])}*&select=id,title,content,category`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
      );
      const existingEntries = existingRes.ok ? await existingRes.json() : [];
      
      // Score existing entries to find best match
      let bestMatch = null;
      const queryTerms = currentQuery.toLowerCase().split(/\s+/).filter(t => t.length > 2);
      for (const entry of existingEntries) {
        const titleLower = (entry.title || '').toLowerCase();
        const contentLower = (entry.content || '').toLowerCase();
        let matchCount = 0;
        queryTerms.forEach(t => {
          if (titleLower.includes(t) || contentLower.includes(t)) matchCount++;
        });
        if (matchCount >= Math.ceil(queryTerms.length * 0.4)) {
          if (!bestMatch || matchCount > bestMatch.matchCount) {
            bestMatch = { ...entry, matchCount };
          }
        }
      }

      if (bestMatch) {
        // UPDATE existing KB entry
        await fetch(`${SUPABASE_URL}/rest/v1/knowledge_base?id=eq.${bestMatch.id}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            content: revisedResponse,
            updated_at: new Date().toISOString()
          })
        });
        console.log(`Updated KB entry: "${bestMatch.title}" (id: ${bestMatch.id})`);
      } else {
        // CREATE new KB entry
        await fetch(`${SUPABASE_URL}/rest/v1/knowledge_base`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            title: currentQuery.substring(0, 200),
            content: revisedResponse,
            category: category !== 'all' ? category : 'faq',
            is_active: true,
            created_by: currentUser?.name || 'Admin'
          })
        });
        console.log(`Created new KB entry for: "${currentQuery}"`);
      }

      // 2. Also add to ai_training table so it persists in system prompt
      await fetch(`${SUPABASE_URL}/rest/v1/ai_training`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          instruction: `When asked "${currentQuery}", respond with: ${revisedResponse.substring(0, 1500)}`,
          category: category !== 'all' ? category : 'general',
          is_active: true,
          priority: 10
        })
      });

      setKbUpdated(true);
      // Update the displayed response to the approved version
      setAiResponse(revisedResponse);
      
      // Reload KB so future queries use updated content
      loadKnowledgeBase();
      
    } catch (err) {
      console.error('KB update error:', err);
      alert('Failed to update knowledge base. Check console for details.');
    } finally {
      setTrainingLoading(false);
    }
  };

  // Reset training state when new query is submitted
  const resetTraining = () => {
    setTrainingMessages([]);
    setTrainingInput('');
    setRevisedResponse(null);
    setKbUpdated(false);
  };
  
  const inputRef = useRef(null);
  const resultsRef = useRef(null);

  useEffect(() => {
    loadKnowledgeBase();
    loadCompanyProfile();
  }, []);

  const loadKnowledgeBase = async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/knowledge_base?is_active=eq.true&select=*`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      if (res.ok) setKnowledgeBase(await res.json() || []);
    } catch (err) { console.error('Failed to load KB:', err); }
  };

  const loadCompanyProfile = async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/company_profile?select=*&limit=1`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.[0]) setCompanyProfile(data[0]);
      }
    } catch (err) { console.error('Failed to load profile:', err); }
  };

  const buildCompanyContext = () => {
    if (!companyProfile) return '';
    const parts = [];
    if (companyProfile.company_name) parts.push(`Company: ${companyProfile.company_name}`);
    if (companyProfile.location) parts.push(`Location: ${companyProfile.location}`);
    if (companyProfile.founded_year) parts.push(`Founded: ${companyProfile.founded_year}`);
    if (companyProfile.clients_helped) parts.push(`Clients helped: ${companyProfile.clients_helped}`);
    if (companyProfile.unique_value) parts.push(`What makes us different: ${companyProfile.unique_value}`);
    if (companyProfile.process_summary) parts.push(`Our process: ${companyProfile.process_summary}`);
    if (companyProfile.pricing_summary) parts.push(`Pricing: ${companyProfile.pricing_summary}`);
    if (companyProfile.team_summary) parts.push(`Team: ${companyProfile.team_summary}`);
    if (companyProfile.compliance_notes) parts.push(`Compliance: ${companyProfile.compliance_notes}`);
    if (companyProfile.additional_context) parts.push(`Additional: ${companyProfile.additional_context}`);
    return parts.join('\n');
  };

  // Find relevant KB docs - filter by category if selected
  const findRelevantDocs = (searchQuery) => {
    if (!searchQuery.trim()) return [];
    
    const terms = searchQuery.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    if (terms.length === 0) return [];
    
    // Filter by category first if not "all"
    let filtered = knowledgeBase;
    if (category !== 'all') {
      filtered = filtered.filter(entry => entry.category === category);
    }
    
    const scored = filtered.map(entry => {
      const title = (entry.title || '').toLowerCase();
      const content = (entry.content || '').toLowerCase();
      const keywords = (entry.keywords || []).join(' ').toLowerCase();
      
      let score = 0;
      let matchedTerms = 0;
      
      terms.forEach(term => {
        let matched = false;
        if (title.includes(term)) { score += 25; matched = true; }
        if (keywords.includes(term)) { score += 20; matched = true; }
        if (content.includes(term)) { score += 5; matched = true; }
        if (matched) matchedTerms++;
      });
      
      // If category is selected, be more lenient with matching
      const minMatch = category !== 'all' ? 0.3 : 0.5;
      if (matchedTerms < Math.ceil(terms.length * minMatch)) score = 0;
      
      return { ...entry, score };
    });
    
    // Lower threshold when category is selected
    const minScore = category !== 'all' ? 5 : 20;
    return scored.filter(e => e.score >= minScore).sort((a, b) => b.score - a.score).slice(0, 5);
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!query.trim() || loading) return;
    
    setError(null);
    setAiResponse(null);
    setCurrentQuery(query);
    setRelevantDocs([]);
    setShowDocs(false);
    resetTraining();
    setLoading(true);
    
    try {
      const docs = findRelevantDocs(query);
      setRelevantDocs(docs);
      
      const kbContext = docs.map(k => `[${k.category?.toUpperCase()}] ${k.title}:\n${k.content}`).join('\n\n---\n\n');
      
      const commInfo = COMMUNICATION_TYPES.find(c => c.id === commType);
      const clientInfo = CLIENT_SITUATIONS.find(c => c.id === clientSituation);
      
      const res = await fetch('/.netlify/functions/ask-openai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyContext: buildCompanyContext(),
          kbContext: kbContext,
          systemPrompt: `
Communication Type: ${commInfo?.name}
Client Situation: ${clientInfo?.name}

Tailor your response for a ${commInfo?.name?.toLowerCase()} with a ${clientInfo?.name?.toLowerCase()}.
${commType === 'sms' ? 'Keep SMS responses SHORT - 2-3 sentences max.' : ''}
${commType === 'email' ? 'Format as a professional email with clear paragraphs.' : ''}
${commType === 'call' ? 'Provide a conversational talk track.' : ''}
`,
          messages: [{ role: 'user', content: query }]
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'AI request failed');
      }
      
      const data = await res.json();
      setAiResponse(data.content || 'No response received.');
      
      logSearch(query);
      
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
      
    } catch (err) {
      console.error('Error:', err);
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const logSearch = async (q) => {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/ai_search_logs`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          search_query: q.substring(0, 500),
          user_id: currentUser?.id,
          user_name: currentUser?.name,
          mode: `${commType}/${clientSituation}`
        })
      });
    } catch (e) { /* ignore */ }
  };

  // Submit simple feedback (regular users)
  const submitFeedback = async (positive) => {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/ai_flagged_responses`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          question: currentQuery,
          ai_response: aiResponse,
          correction: positive ? 'Thumbs up - helpful' : 'Thumbs down - not helpful',
          user_id: currentUser?.id,
          user_name: currentUser?.name,
          status: positive ? 'positive' : 'pending'
        })
      });
    } catch (err) {
      console.error('Failed to submit feedback:', err);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const extractUrls = (text) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text?.match(urlRegex) || [];
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">ASAP AI</h1>
              <p className="text-slate-500 text-sm">Ask anything about ASAP Credit Repair</p>
            </div>
          </div>
        </div>

        {/* Search Box */}
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-4 mb-6 shadow-sm">
          <form onSubmit={handleSubmit}>
            {/* Filters Row */}
            <div className="flex flex-wrap gap-4 mb-4">
              {/* Communication Type */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Communication</label>
                <div className="flex gap-1">
                  {COMMUNICATION_TYPES.map(type => {
                    const Icon = type.icon;
                    return (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setCommType(type.id)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          commType === type.id
                            ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-500'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        <Icon size={14} />
                        {type.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              
              {/* Client Situation */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Client Type</label>
                <div className="flex gap-1">
                  {CLIENT_SITUATIONS.map(sit => {
                    const Icon = sit.icon;
                    return (
                      <button
                        key={sit.id}
                        type="button"
                        onClick={() => setClientSituation(sit.id)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          clientSituation === sit.id
                            ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-500'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        <Icon size={14} />
                        {sit.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            
            {/* Category Filter */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Search In</label>
              <div className="flex flex-wrap gap-1">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      category === cat.id
                        ? 'bg-purple-100 text-purple-700 ring-2 ring-purple-500'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Search Input */}
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ask anything... objections, pricing, processes, scripts..."
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={!query.trim() || loading}
                className="px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-semibold hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 flex items-center gap-2 shadow-lg"
              >
                {loading ? <Loader size={20} className="animate-spin" /> : <Sparkles size={20} />}
                Ask
              </button>
            </div>
          </form>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="text-red-500 flex-shrink-0" size={20} />
            <div>
              <p className="font-medium text-red-800">Error</p>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Results */}
        <div ref={resultsRef}>
          {loading && (
            <div className="bg-white rounded-2xl border-2 border-slate-200 p-8 text-center">
              <Loader size={32} className="animate-spin text-emerald-600 mx-auto mb-3" />
              <p className="text-slate-600">Thinking...</p>
            </div>
          )}

          {/* KB Results FIRST when specific category selected */}
          {!loading && category !== 'all' && relevantDocs.length > 0 && (
            <div className="bg-purple-50 rounded-xl border border-purple-200 p-4 mb-4">
              <h3 className="font-semibold text-purple-800 mb-3 flex items-center gap-2">
                <FileText size={16} />
                {CATEGORIES.find(c => c.id === category)?.name} from Knowledge Base
              </h3>
              <div className="space-y-3">
                {relevantDocs.map((doc, idx) => {
                  const urls = extractUrls(doc.content);
                  return (
                    <div key={doc.id || idx} className="bg-white rounded-lg border border-purple-100 p-4">
                      <h4 className="font-medium text-slate-800 mb-2">{doc.title}</h4>
                      <p className="text-sm text-slate-600 whitespace-pre-wrap">{doc.content}</p>
                      {urls.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {urls.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-lg hover:bg-blue-100">
                              <ExternalLink size={12} />
                              {url.length > 35 ? url.substring(0, 35) + '...' : url}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {aiResponse && !loading && (
            <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-lg overflow-hidden">
              {/* Response Header */}
              <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <Sparkles size={18} className="text-emerald-600" />
                  <span className="font-semibold text-slate-800">ASAP AI</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyToClipboard(aiResponse)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:bg-white rounded-lg transition-colors"
                  >
                    {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
              
              {/* Response Body */}
              <div className="p-6">
                <div className="prose prose-slate max-w-none">
                  <div className="whitespace-pre-wrap text-slate-700 leading-relaxed">{aiResponse}</div>
                </div>
              </div>
              
              {/* Feedback */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
                {/* ADMIN VIEW - Conversational Training */}
                {(currentUser?.role === 'admin' || currentUser?.department === 'leadership') ? (
                  <div className="space-y-4">
                    {/* Training conversation history */}
                    {trainingMessages.length > 0 && (
                      <div className="space-y-3 max-h-80 overflow-y-auto">
                        {trainingMessages.map((msg, idx) => (
                          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${
                              msg.role === 'user' 
                                ? 'bg-amber-100 text-amber-900 border border-amber-200' 
                                : 'bg-white text-slate-700 border border-emerald-200 shadow-sm'
                            }`}>
                              {msg.role !== 'user' && (
                                <div className="flex items-center gap-1.5 mb-1.5">
                                  <Sparkles size={12} className="text-emerald-600" />
                                  <span className="text-xs font-semibold text-emerald-700">Revised Response</span>
                                </div>
                              )}
                              <div className="whitespace-pre-wrap">{msg.content}</div>
                            </div>
                          </div>
                        ))}
                        {trainingLoading && (
                          <div className="flex justify-start">
                            <div className="bg-white rounded-xl px-4 py-3 border border-emerald-200 shadow-sm">
                              <Loader size={16} className="animate-spin text-emerald-600" />
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* KB Updated confirmation */}
                    {kbUpdated && (
                      <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl p-4">
                        <Check size={18} className="text-green-600" />
                        <div>
                          <p className="text-sm font-semibold text-green-800">Knowledge Base Updated!</p>
                          <p className="text-xs text-green-700">The AI will use this improved answer for future questions.</p>
                        </div>
                      </div>
                    )}

                    {/* Approve button - only show when there's a revised response and not yet approved */}
                    {revisedResponse && !kbUpdated && (
                      <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-emerald-800">Like this revised response?</p>
                          <p className="text-xs text-emerald-600">Click approve to update the Knowledge Base automatically.</p>
                        </div>
                        <button
                          onClick={approveAndUpdateKB}
                          disabled={trainingLoading}
                          className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2 shadow-md whitespace-nowrap"
                        >
                          {trainingLoading ? <Loader size={14} className="animate-spin" /> : <Check size={14} />}
                          Yes, Update KB
                        </button>
                      </div>
                    )}

                    {/* Input area */}
                    {!kbUpdated && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded">ADMIN</div>
                          <span className="text-xs text-slate-500">
                            {trainingMessages.length === 0 
                              ? 'Give feedback to improve this response — the AI will revise it for you' 
                              : 'Continue giving feedback or approve the response above'}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={trainingInput}
                            onChange={(e) => setTrainingInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendTrainingFeedback()}
                            placeholder={trainingMessages.length === 0 
                              ? "e.g., Don't mention compliance strike rounds, instead say we focus on documentation-based disputes..." 
                              : "Give more feedback or click 'Yes, Update KB' above..."}
                            className="flex-1 px-4 py-2.5 border border-amber-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                            disabled={trainingLoading}
                          />
                          <button
                            onClick={sendTrainingFeedback}
                            disabled={!trainingInput.trim() || trainingLoading}
                            className="px-4 py-2.5 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50 flex items-center gap-2"
                          >
                            {trainingLoading ? <Loader size={14} className="animate-spin" /> : <Send size={14} />}
                            Revise
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* REGULAR USER VIEW */
                  <>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-slate-500">Was this helpful?</span>
                      <button 
                        onClick={() => submitFeedback(true)}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-600 hover:bg-green-100 hover:text-green-700 rounded-lg transition-colors"
                      >
                        <ThumbsUp size={14} /> Yes
                      </button>
                      <button 
                        onClick={() => submitFeedback(false)}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-600 hover:bg-red-100 hover:text-red-700 rounded-lg transition-colors"
                      >
                        <ThumbsDown size={14} /> No
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Related Documents - Only show collapsed when "All" category (already shown above for specific categories) */}
          {aiResponse && category === 'all' && relevantDocs.length > 0 && (
            <div className="mt-4">
              <button
                onClick={() => setShowDocs(!showDocs)}
                className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
              >
                <FileText size={14} />
                {relevantDocs.length} related document{relevantDocs.length > 1 ? 's' : ''} from Knowledge Base
                {showDocs ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              
              {showDocs && (
                <div className="mt-3 space-y-3">
                  {relevantDocs.map((doc, idx) => {
                    const urls = extractUrls(doc.content);
                    return (
                      <div key={doc.id || idx} className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-200 text-slate-600">
                            {doc.category}
                          </span>
                          <h4 className="font-medium text-slate-800">{doc.title}</h4>
                        </div>
                        <p className="text-sm text-slate-600 whitespace-pre-wrap">{doc.content}</p>
                        {urls.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {urls.map((url, i) => (
                              <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-lg hover:bg-blue-100">
                                <ExternalLink size={12} />
                                {url.length > 35 ? url.substring(0, 35) + '...' : url}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Empty State */}
        {!loading && !aiResponse && !error && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Sparkles size={32} className="text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-700 mb-2">Ask me anything</h3>
            <p className="text-slate-500 mb-6">I know about ASAP Credit Repair, pricing, processes, and how to handle objections.</p>
            
            <div className="flex flex-wrap justify-center gap-2">
              {[
                "What makes ASAP different?",
                "Client says it's too expensive",
                "How does the process work?",
                "What can we guarantee?"
              ].map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => { setQuery(suggestion); inputRef.current?.focus(); }}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-600 hover:border-emerald-300 hover:shadow-sm transition-all"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
