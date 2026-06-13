import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { 
  Sparkles, Send, Upload, File, FileText, Check, X, Loader, 
  MessageSquare, Database, Edit2, AlertCircle, Save,
  CheckCircle, ChevronDown, ChevronUp, ExternalLink
} from 'lucide-react';

const SUPABASE_URL = 'https://kkcbpqbcpzcarxhknzza.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0';

const CATEGORIES = [
  { id: 'company_info', name: 'Company Info' },
  { id: 'process', name: 'Process/Procedure' },
  { id: 'scripts', name: 'Scripts/Templates' },
  { id: 'pricing', name: 'Pricing' },
  { id: 'faq', name: 'FAQ' },
  { id: 'objections', name: 'Objections' },
  { id: 'compliance', name: 'Compliance' },
  { id: 'links', name: 'Links/Resources' },
  { id: 'team', name: 'Team Info' },
];

const ASSISTANT_SYSTEM = `You are a Knowledge Base Assistant for ASAP Credit Repair USA. You act like a smart, detail-oriented employee whose job is to help organize and store company information.

YOUR ROLE:
- Take whatever information is given (documents, text, processes, notes, links, etc.)
- Understand what type of information it is
- Ask 1-2 clarifying questions if something is unclear
- Help organize it into proper knowledge base entries

HOW TO RESPOND:
1. Acknowledge what you received and summarize it briefly
2. If anything is unclear, ask a quick question
3. When ready to save, include a save block (see format below)

WHEN READY TO SAVE, include this exact format in your response:
\`\`\`save
{"entries":[{"category":"process","title":"Title Here","content":"Full content here","keywords":["keyword1","keyword2"],"priority":5}]}
\`\`\`

CATEGORIES: company_info, process, scripts, pricing, faq, objections, compliance, links, team

IMPORTANT:
- Be conversational and brief
- Extract ALL useful info (URLs, numbers, names, steps)
- If there are multiple topics, create multiple entries
- Don't over-ask questions - if you have enough info, just save it`;

export default function KnowledgeAssistant() {
  const { currentUser } = useApp();
  const [messages, setMessages] = useState([
    { 
      role: 'assistant', 
      content: `Hey! I'm here to help you add information to the Knowledge Base.\n\n• **Upload a file** — Word docs (.docx), text files, CSV\n• **Paste text** — processes, scripts, notes, anything\n• **Tell me things** — "Our office is in Phoenix" etc.\n\nWhat do you have for me?` 
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingEntries, setPendingEntries] = useState([]);
  const [editingEntry, setEditingEntry] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showEntries, setShowEntries] = useState(true);
  const [uploadError, setUploadError] = useState(null);
  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);

  const isAdmin = currentUser?.role === 'admin' || currentUser?.department === 'leadership';

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Parse save block from AI response
  const parseSaveBlock = (text) => {
    const match = text.match(/```save\s*([\s\S]*?)```/);
    if (match) {
      try {
        const parsed = JSON.parse(match[1].trim());
        return parsed;
      } catch (e) {
        console.error('Failed to parse save block:', e);
      }
    }
    return null;
  };

  // Clean response text for display
  const cleanResponseText = (text) => {
    return text.replace(/```save[\s\S]*?```/g, '').trim();
  };

  // Handle file upload
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setLoading(true);
    setUploadError(null);
    
    try {
      // Convert to base64
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });
      
      // Call parse-document function
      const parseRes = await fetch('/.netlify/functions/parse-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          fileContent: base64, 
          fileType: file.type, 
          fileName: file.name 
        })
      });
      
      const parseData = await parseRes.json();
      
      if (!parseRes.ok || parseData.error) {
        throw new Error(parseData.error || 'Failed to parse document');
      }
      
      if (parseData.text && parseData.text.length > 20) {
        // Success! Show in chat and analyze
        const preview = parseData.text.length > 500 
          ? parseData.text.substring(0, 500) + '...' 
          : parseData.text;
        
        setMessages(prev => [...prev, { 
          role: 'user', 
          content: `📄 **Uploaded: ${file.name}**\n\n${preview}` 
        }]);
        
        // Send full content to AI
        await analyzeContent(parseData.text, file.name);
      } else {
        throw new Error('Document appears empty');
      }
    } catch (err) {
      console.error('Upload error:', err);
      setUploadError(err.message);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ **Couldn't read that file:** ${err.message}\n\nTry:\n• Save as .docx or .txt format\n• Copy the text and paste it here instead`
      }]);
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Analyze content with AI
  const analyzeContent = async (content, fileName) => {
    setLoading(true);
    
    try {
      const res = await fetch('/.netlify/functions/ask-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'knowledge_assistant',
          system: ASSISTANT_SYSTEM,
          messages: [{ 
            role: 'user', 
            content: `I'm uploading a document called "${fileName}". Here's the content:\n\n---\n${content.substring(0, 12000)}\n---\n\nPlease analyze this and organize it into knowledge base entries.` 
          }]
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server error: ${res.status}`);
      }
      
      const data = await res.json();
      const responseText = data.content?.[0]?.text || '';
      
      if (!responseText) {
        throw new Error('Empty response from AI');
      }
      
      // Check for save block
      const saveData = parseSaveBlock(responseText);
      if (saveData?.entries?.length > 0) {
        setPendingEntries(prev => [...prev, ...saveData.entries]);
        setShowEntries(true);
      }
      
      // Add response to chat
      const cleanText = cleanResponseText(responseText);
      if (cleanText) {
        setMessages(prev => [...prev, { role: 'assistant', content: cleanText }]);
      } else if (saveData?.entries?.length > 0) {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `Got it! I found ${saveData.entries.length} piece${saveData.entries.length > 1 ? 's' : ''} of information to save. Check the panel below to review and save.` 
        }]);
      }
      
    } catch (err) {
      console.error('AI error:', err);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `⚠️ **Error:** ${err.message}\n\nThe AI service may be temporarily unavailable. You can try again or paste the content directly.`
      }]);
    } finally {
      setLoading(false);
    }
  };

  // Send chat message
  const sendMessage = async () => {
    const userMessage = input.trim();
    if (!userMessage || loading) return;
    
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      // Build conversation history (last 8 messages)
      const history = messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .slice(-8)
        .map(m => ({ role: m.role, content: m.content.substring(0, 2000) }));
      
      const res = await fetch('/.netlify/functions/ask-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'knowledge_assistant',
          system: ASSISTANT_SYSTEM,
          messages: [...history, { role: 'user', content: userMessage }]
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server error: ${res.status}`);
      }
      
      const data = await res.json();
      const responseText = data.content?.[0]?.text || '';
      
      if (!responseText) {
        throw new Error('Empty response from AI');
      }
      
      // Check for save block
      const saveData = parseSaveBlock(responseText);
      if (saveData?.entries?.length > 0) {
        setPendingEntries(prev => [...prev, ...saveData.entries]);
        setShowEntries(true);
      }
      
      const cleanText = cleanResponseText(responseText);
      if (cleanText) {
        setMessages(prev => [...prev, { role: 'assistant', content: cleanText }]);
      } else if (saveData?.entries?.length > 0) {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `I've organized that into ${saveData.entries.length} knowledge base entries. Review them below!` 
        }]);
      }
      
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `⚠️ **Error:** ${err.message}\n\nPlease try again. If the problem persists, the API key may need to be configured in Netlify.`
      }]);
    } finally {
      setLoading(false);
    }
  };

  // Save entries to database
  const saveEntries = async () => {
    if (pendingEntries.length === 0) return;
    
    setSaving(true);
    let saved = 0;
    let errors = 0;
    
    for (const entry of pendingEntries) {
      try {
        let fullContent = entry.content || '';
        if (entry.urls?.length > 0) {
          fullContent += '\n\nRelated Links:\n' + entry.urls.map(u => `• ${u}`).join('\n');
        }
        
        const res = await fetch(`${SUPABASE_URL}/rest/v1/knowledge_base`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            title: entry.title || 'Untitled',
            category: entry.category || 'faq',
            content: fullContent,
            keywords: entry.keywords || [],
            priority: entry.priority || 5,
            is_active: true,
            created_by: currentUser?.id
          })
        });
        
        if (res.ok) saved++;
        else errors++;
      } catch (err) {
        console.error('Save error:', err);
        errors++;
      }
    }
    
    setSaving(false);
    
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: errors === 0 
        ? `✅ **Saved ${saved} ${saved === 1 ? 'entry' : 'entries'}** to the Knowledge Base! The AI can now use this information.\n\nAnything else?`
        : `⚠️ Saved ${saved} entries, but ${errors} failed. You can try again.`
    }]);
    
    if (saved > 0) {
      setPendingEntries(prev => prev.slice(saved));
    }
  };

  const removeEntry = (index) => {
    setPendingEntries(prev => prev.filter((_, i) => i !== index));
  };

  const updateEntry = (index, field, value) => {
    setPendingEntries(prev => prev.map((e, i) => i === index ? { ...e, [field]: value } : e));
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
    <div className="h-[calc(100vh-64px)] flex flex-col bg-slate-50">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Knowledge Assistant</h1>
              <p className="text-sm text-slate-500">Upload docs or tell me information to save</p>
            </div>
          </div>
          <Link to="/admin/knowledge" className="flex items-center gap-2 text-sm text-slate-600 hover:text-indigo-600">
            <Database size={16} /> View Knowledge Base
          </Link>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                msg.role === 'user' 
                  ? 'bg-indigo-600 text-white' 
                  : 'bg-white border border-slate-200 text-slate-800'
              }`}>
                <div 
                  className="whitespace-pre-wrap text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{ 
                    __html: msg.content
                      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                      .replace(/\n/g, '<br/>') 
                  }} 
                />
              </div>
            </div>
          ))}
          
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2 text-slate-500">
                  <Loader size={16} className="animate-spin" />
                  <span className="text-sm">Processing...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Pending Entries Panel */}
      {pendingEntries.length > 0 && (
        <div className="flex-shrink-0 bg-white border-t border-slate-200">
          <div className="max-w-4xl mx-auto">
            <button 
              onClick={() => setShowEntries(!showEntries)}
              className="w-full px-6 py-3 flex items-center justify-between text-left hover:bg-slate-50"
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                  <span className="text-xs font-bold text-white">{pendingEntries.length}</span>
                </div>
                <span className="font-medium text-slate-800">Ready to Save</span>
              </div>
              {showEntries ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
            </button>
            
            {showEntries && (
              <div className="px-6 pb-4 space-y-2 max-h-64 overflow-y-auto">
                {pendingEntries.map((entry, idx) => (
                  <div key={idx} className="bg-slate-50 rounded-lg p-3">
                    {editingEntry === idx ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={entry.title || ''}
                          onChange={(e) => updateEntry(idx, 'title', e.target.value)}
                          className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded"
                          placeholder="Title"
                        />
                        <select
                          value={entry.category || 'faq'}
                          onChange={(e) => updateEntry(idx, 'category', e.target.value)}
                          className="px-3 py-1.5 text-sm border border-slate-200 rounded"
                        >
                          {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <textarea
                          value={entry.content || ''}
                          onChange={(e) => updateEntry(idx, 'content', e.target.value)}
                          rows={3}
                          className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded"
                        />
                        <button onClick={() => setEditingEntry(null)} className="text-sm text-indigo-600 font-medium">Done</button>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-medium rounded">
                              {CATEGORIES.find(c => c.id === entry.category)?.name || entry.category}
                            </span>
                          </div>
                          <p className="font-medium text-sm text-slate-800">{entry.title || 'Untitled'}</p>
                          <p className="text-xs text-slate-500 line-clamp-2 mt-1">{entry.content}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => setEditingEntry(idx)} className="p-1.5 text-slate-400 hover:text-indigo-600">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => removeEntry(idx)} className="p-1.5 text-slate-400 hover:text-red-600">
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                
                <button
                  onClick={saveEntries}
                  disabled={saving}
                  className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 font-medium"
                >
                  {saving ? <Loader size={16} className="animate-spin" /> : <Save size={16} />}
                  {saving ? 'Saving...' : `Save ${pendingEntries.length} to Knowledge Base`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="flex-shrink-0 bg-white border-t border-slate-200 px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-end gap-3">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".docx,.doc,.txt,.md,.csv,.pdf"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="flex-shrink-0 p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors disabled:opacity-50"
              title="Upload document (.docx, .txt, .csv)"
            >
              <Upload size={20} />
            </button>
            
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Paste text, describe a process, or tell me information... (Shift+Enter for new line)"
              rows={1}
              disabled={loading}
              className="flex-1 px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none text-sm disabled:opacity-50"
              style={{ minHeight: '48px', maxHeight: '120px' }}
              onInput={(e) => {
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
              }}
            />
            
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="flex-shrink-0 p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={20} />
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-2 text-center">
            Supports: .docx, .txt, .csv • Or just paste/type content directly
          </p>
        </div>
      </div>
    </div>
  );
}
