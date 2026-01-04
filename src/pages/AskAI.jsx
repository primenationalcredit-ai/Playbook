import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { 
  MessageSquare, 
  Send, 
  Sparkles, 
  ThumbsUp, 
  ThumbsDown,
  Lightbulb,
  Clock,
  Search,
  RefreshCw,
  Copy,
  Check,
  ChevronDown,
  Zap,
  Phone,
  Mail,
  MessageCircle,
  User,
  Users,
  UserCheck,
  AlertCircle
} from 'lucide-react';

const SUPABASE_URL = 'https://kkcbpqbcpzcarxhknzza.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0';

// API endpoint - uses Netlify function in production, direct API in development
const getApiEndpoint = () => {
  // In production (Netlify), use the serverless function
  if (window.location.hostname !== 'localhost') {
    return '/.netlify/functions/ask-ai';
  }
  // In development, use direct API (requires VITE_ANTHROPIC_API_KEY)
  return 'https://api.anthropic.com/v1/messages';
};

const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY || '';

const CATEGORIES = [
  { id: 'all', name: 'All Topics', icon: Sparkles, color: 'blue' },
  { id: 'objections', name: 'Objections', icon: MessageSquare, color: 'red' },
  { id: 'pricing', name: 'Pricing', icon: Zap, color: 'green' },
  { id: 'process', name: 'Process', icon: RefreshCw, color: 'purple' },
  { id: 'faq', name: 'FAQ', icon: Lightbulb, color: 'amber' },
  { id: 'compliance', name: 'Compliance', icon: Search, color: 'slate' },
];

const COMMUNICATION_TYPES = [
  { id: 'sms', name: 'SMS/Text', icon: MessageCircle, description: 'Short, punchy response' },
  { id: 'call', name: 'Phone Call', icon: Phone, description: 'Conversational script' },
  { id: 'email', name: 'Email', icon: Mail, description: 'Professional written response' },
];

const CLIENT_SITUATIONS = [
  { id: 'new_lead', name: 'New Lead', icon: User, description: 'First contact, no quote yet' },
  { id: 'quoted', name: 'Already Quoted', icon: UserCheck, description: 'Received pricing, considering' },
  { id: 'current', name: 'Current Client', icon: Users, description: 'Active client with question' },
  { id: 'past', name: 'Past Client', icon: Clock, description: 'Former client reaching out' },
];

const QUICK_PROMPTS = [
  "Client says it's too expensive",
  "Client wants to think about it",
  "Client says they can do it themselves",
  "How do I explain our process?",
  "Client asks if this really works",
  "Client found a cheaper option",
];

export default function AskAI() {
  const { currentUser } = useApp();
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState('all');
  const [commType, setCommType] = useState('call');
  const [clientSituation, setClientSituation] = useState('quoted');
  const [recentQuestions, setRecentQuestions] = useState([]);
  const [copied, setCopied] = useState(null);
  const [knowledgeBase, setKnowledgeBase] = useState([]);
  const [showOptions, setShowOptions] = useState(false);
  const inputRef = useRef(null);
  const responseRef = useRef(null);

  // Load knowledge base
  useEffect(() => {
    loadKnowledgeBase();
    loadRecentQuestions();
  }, []);

  const loadKnowledgeBase = async () => {
    try {
      const url = `${SUPABASE_URL}/rest/v1/knowledge_base?is_active=eq.true&select=*`;
      const res = await fetch(url, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        }
      });
      if (res.ok) {
        const data = await res.json();
        setKnowledgeBase(data || []);
      }
    } catch (error) {
      console.error('Error loading knowledge base:', error);
    }
  };

  const loadRecentQuestions = async () => {
    try {
      const url = `${SUPABASE_URL}/rest/v1/ai_chat_history?select=question,created_at&order=created_at.desc&limit=5`;
      const res = await fetch(url, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        }
      });
      if (res.ok) {
        const data = await res.json();
        setRecentQuestions(data || []);
      }
    } catch (error) {
      console.error('Error loading recent questions:', error);
    }
  };

  const searchKnowledgeBase = (searchQuery) => {
    const queryLower = searchQuery.toLowerCase();
    const words = queryLower.split(/\s+/).filter(w => w.length > 2);
    
    const scored = knowledgeBase.map(entry => {
      let score = 0;
      
      if (entry.keywords) {
        entry.keywords.forEach(keyword => {
          if (queryLower.includes(keyword.toLowerCase())) {
            score += 10;
          }
          words.forEach(word => {
            if (keyword.toLowerCase().includes(word)) {
              score += 5;
            }
          });
        });
      }
      
      words.forEach(word => {
        if (entry.title.toLowerCase().includes(word)) score += 3;
        if (entry.content.toLowerCase().includes(word)) score += 1;
      });
      
      if (category !== 'all' && entry.category !== category) {
        score = score * 0.5;
      }
      
      score += entry.priority || 0;
      
      return { ...entry, score };
    });
    
    return scored
      .filter(e => e.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  };

  const generateAIResponse = async (userQuery, relevantKnowledge) => {
    const context = relevantKnowledge.map(k => 
      `[${k.category.toUpperCase()}] ${k.title}:\n${k.content}`
    ).join('\n\n---\n\n');

    const commTypeInfo = COMMUNICATION_TYPES.find(c => c.id === commType);
    const situationInfo = CLIENT_SITUATIONS.find(s => s.id === clientSituation);

    const systemPrompt = `You are an elite sales coach for ASAP Credit Repair consultants, trained in Alex Hormozi's value-based selling methodology. You help consultants handle objections and close deals.

COMMUNICATION TYPE: ${commTypeInfo?.name} (${commTypeInfo?.description})
CLIENT SITUATION: ${situationInfo?.name} (${situationInfo?.description})

YOUR RESPONSE STYLE (Hormozi Method):
- Lead with VALUE, not price - what is bad credit COSTING them?
- Make the ROI obvious - savings from better rates > your fee
- Remove ALL risk - guarantees, cancel anytime, results-based
- Stack value - everything included, bonuses, support
- Create urgency without pressure - the cost of waiting
- Be confident and direct - you KNOW this works
- Use pattern interrupts - say something unexpected
- Ask questions that lead to "yes"

${commType === 'sms' ? `
SMS RULES:
- Keep it SHORT (2-4 sentences max)
- Casual but professional tone
- End with a question or soft CTA
- No walls of text
- Use line breaks for readability
` : ''}

${commType === 'email' ? `
EMAIL RULES:
- Professional but warm
- Clear subject line suggestion
- Short paragraphs
- Bullet points for value stacking
- Clear call to action
` : ''}

${commType === 'call' ? `
CALL SCRIPT RULES:
- Conversational, not robotic
- Include pauses and questions
- Handle the objection, then pivot
- End with a close or next step
` : ''}

${context ? `
RELEVANT COMPANY KNOWLEDGE:
${context}

Use this company-specific information when applicable.
` : ''}

CRITICAL COMPLIANCE:
- Never guarantee specific point increases
- Never promise removal of specific items
- Focus on the PROCESS and typical results
- Always be truthful

Provide 2-3 response options for the consultant to choose from, tailored for ${commTypeInfo?.name}. Label them as Option 1, Option 2, etc.`;

    try {
      const endpoint = getApiEndpoint();
      const isNetlifyFunction = endpoint.includes('netlify');
      
      const requestBody = isNetlifyFunction 
        ? {
            system: systemPrompt,
            messages: [
              { role: 'user', content: `Client situation: ${userQuery}\n\nGive me ${commType === 'sms' ? 'SMS text message' : commType === 'email' ? 'email' : 'phone script'} responses I can use.` }
            ]
          }
        : {
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1500,
            system: systemPrompt,
            messages: [
              { role: 'user', content: `Client situation: ${userQuery}\n\nGive me ${commType === 'sms' ? 'SMS text message' : commType === 'email' ? 'email' : 'phone script'} responses I can use.` }
            ]
          };

      const headers = isNetlifyFunction 
        ? { 'Content-Type': 'application/json' }
        : {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
          };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });

      if (!res.ok) {
        const error = await res.json();
        console.error('API Error:', error);
        throw new Error(error.error?.message || 'API request failed');
      }

      const data = await res.json();
      return data.content[0].text;
    } catch (error) {
      console.error('AI Error:', error);
      throw error;
    }
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!query.trim() || loading) return;

    setLoading(true);
    setResponse(null);

    try {
      const relevantKnowledge = searchKnowledgeBase(query);
      const isProduction = window.location.hostname !== 'localhost';
      
      // In production, always use the Netlify function (API key is server-side)
      // In development, require VITE_ANTHROPIC_API_KEY
      if (!isProduction && !ANTHROPIC_API_KEY) {
        // Fallback if no API key in development
        if (relevantKnowledge.length > 0) {
          setResponse({
            text: relevantKnowledge.map(k => `**${k.title}**\n\n${k.content}`).join('\n\n---\n\n'),
            sources: relevantKnowledge,
            query: query
          });
        } else {
          setResponse({
            text: "API key not configured. Please add your Anthropic API key to enable AI responses, or add this topic to the Knowledge Base.",
            sources: [],
            query: query,
            error: true
          });
        }
      } else {
        // Use Claude API (via Netlify function in production, direct in development)
        const aiResponse = await generateAIResponse(query, relevantKnowledge);
        setResponse({
          text: aiResponse,
          sources: relevantKnowledge,
          query: query
        });
        await saveToHistory(query, aiResponse);
      }
      
      setTimeout(() => {
        responseRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

    } catch (error) {
      setResponse({
        text: `Error: ${error.message}`,
        sources: [],
        query: query,
        error: true
      });
    } finally {
      setLoading(false);
    }
  };

  const saveToHistory = async (question, responseText) => {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/ai_chat_history`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          user_id: currentUser?.id,
          question,
          response: responseText,
          category
        })
      });
    } catch (error) {
      console.error('Error saving to history:', error);
    }
  };

  const copyToClipboard = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopied(index);
    setTimeout(() => setCopied(null), 2000);
  };

  const copyFullResponse = () => {
    if (response?.text) {
      navigator.clipboard.writeText(response.text);
      setCopied('full');
      setTimeout(() => setCopied(null), 2000);
    }
  };

  const handleQuickPrompt = (prompt) => {
    setQuery(prompt);
    inputRef.current?.focus();
  };

  // Parse response into options
  const parseOptions = (text) => {
    if (!text) return [];
    const optionRegex = /(?:Option\s*(\d+)[:\s]*|(\d+)\.\s*)/gi;
    const parts = text.split(optionRegex).filter(Boolean);
    
    // If no clear options, return the whole text as one option
    if (parts.length <= 1) {
      return [{ label: 'Response', text: text }];
    }

    const options = [];
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].trim();
      if (/^\d+$/.test(part) && parts[i + 1]) {
        options.push({
          label: `Option ${part}`,
          text: parts[i + 1].trim()
        });
        i++;
      }
    }
    
    return options.length > 0 ? options : [{ label: 'Response', text: text }];
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Ask ASAP AI</h1>
          <p className="text-slate-500 text-sm">Get instant help with objections, questions, and scripts</p>
        </div>
      </div>

      {/* Context Options */}
      <div className="bg-white rounded-2xl border-2 border-slate-100 p-4 mb-6">
        <button 
          onClick={() => setShowOptions(!showOptions)}
          className="flex items-center justify-between w-full text-left"
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-700">Response Settings:</span>
            <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
              {COMMUNICATION_TYPES.find(c => c.id === commType)?.name}
            </span>
            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
              {CLIENT_SITUATIONS.find(s => s.id === clientSituation)?.name}
            </span>
          </div>
          <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${showOptions ? 'rotate-180' : ''}`} />
        </button>
        
        {showOptions && (
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
            {/* Communication Type */}
            <div>
              <p className="text-sm font-medium text-slate-600 mb-2">How are you communicating?</p>
              <div className="flex gap-2">
                {COMMUNICATION_TYPES.map(type => (
                  <button
                    key={type.id}
                    onClick={() => setCommType(type.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      commType === type.id
                        ? 'bg-purple-600 text-white shadow-lg'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <type.icon size={18} />
                    {type.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Client Situation */}
            <div>
              <p className="text-sm font-medium text-slate-600 mb-2">What's the client situation?</p>
              <div className="flex flex-wrap gap-2">
                {CLIENT_SITUATIONS.map(situation => (
                  <button
                    key={situation.id}
                    onClick={() => setClientSituation(situation.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      clientSituation === situation.id
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <situation.icon size={18} />
                    {situation.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Search Input */}
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            <MessageSquare size={20} />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What's the objection or situation? (e.g., Client says price is too high)"
            className="w-full pl-12 pr-24 py-4 text-lg border-2 border-slate-200 rounded-2xl focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100 transition-all"
          />
          <button
            type="submit"
            disabled={!query.trim() || loading}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-medium hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
          >
            {loading ? (
              <RefreshCw size={18} className="animate-spin" />
            ) : (
              <Send size={18} />
            )}
            Ask
          </button>
        </div>
      </form>

      {/* Quick Prompts */}
      {!response && (
        <div className="mb-8">
          <p className="text-sm text-slate-500 mb-3 flex items-center gap-2">
            <Lightbulb size={16} />
            Common objections:
          </p>
          <div className="flex flex-wrap gap-2">
            {QUICK_PROMPTS.map((prompt, i) => (
              <button
                key={i}
                onClick={() => handleQuickPrompt(prompt)}
                className="px-4 py-2 bg-white border border-slate-200 rounded-full text-sm text-slate-600 hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700 transition-all"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Sparkles className="w-8 h-8 text-purple-600 animate-pulse" />
          </div>
          <p className="text-slate-600 font-medium">Generating {COMMUNICATION_TYPES.find(c => c.id === commType)?.name} responses...</p>
          <p className="text-slate-400 text-sm mt-1">Crafting the perfect reply for you</p>
        </div>
      )}

      {/* Response */}
      {response && !loading && (
        <div ref={responseRef} className={`rounded-2xl p-6 mb-6 ${response.error ? 'bg-red-50 border-2 border-red-200' : 'bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-200'}`}>
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${response.error ? 'bg-red-500' : 'bg-gradient-to-r from-purple-600 to-indigo-600'}`}>
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-slate-700">
                {COMMUNICATION_TYPES.find(c => c.id === commType)?.name} Response Options
              </span>
            </div>
            <button
              onClick={copyFullResponse}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:bg-white rounded-lg transition-colors"
            >
              {copied === 'full' ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
              {copied === 'full' ? 'Copied!' : 'Copy All'}
            </button>
          </div>

          {/* Response Options */}
          {!response.error && (
            <div className="space-y-4">
              {parseOptions(response.text).map((option, index) => (
                <div key={index} className="bg-white rounded-xl p-4 border border-purple-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-purple-600">{option.label}</span>
                    <button
                      onClick={() => copyToClipboard(option.text, index)}
                      className="flex items-center gap-1 px-3 py-1 text-xs bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
                    >
                      {copied === index ? <Check size={14} /> : <Copy size={14} />}
                      {copied === index ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{option.text}</p>
                </div>
              ))}
            </div>
          )}

          {response.error && (
            <div className="text-red-700 whitespace-pre-wrap">{response.text}</div>
          )}

          {/* Sources */}
          {response.sources?.length > 0 && (
            <div className="mt-6 pt-4 border-t border-purple-200">
              <p className="text-xs text-slate-500 mb-2">Enhanced with company knowledge:</p>
              <div className="flex flex-wrap gap-2">
                {response.sources.map((source, i) => (
                  <span key={i} className="px-3 py-1 bg-white rounded-full text-xs text-slate-600 border border-slate-200">
                    {source.title}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Feedback */}
          {!response.error && (
            <div className="mt-4 pt-4 border-t border-purple-200 flex items-center gap-4">
              <span className="text-sm text-slate-500">Was this helpful?</span>
              <button className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-600 hover:bg-green-100 hover:text-green-700 rounded-lg transition-colors">
                <ThumbsUp size={16} /> Yes
              </button>
              <button className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-600 hover:bg-red-100 hover:text-red-700 rounded-lg transition-colors">
                <ThumbsDown size={16} /> No
              </button>
            </div>
          )}
        </div>
      )}

      {/* Recent Questions */}
      {recentQuestions.length > 0 && !response && (
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-slate-500 mb-3 flex items-center gap-2">
            <Clock size={16} />
            Recently Asked
          </h3>
          <div className="space-y-2">
            {recentQuestions.map((q, i) => (
              <button
                key={i}
                onClick={() => handleQuickPrompt(q.question)}
                className="w-full text-left px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all"
              >
                {q.question}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* API Key Status */}
      {!ANTHROPIC_API_KEY && (
        <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">AI Not Connected</p>
            <p className="text-sm text-amber-700 mt-1">
              Add your Anthropic API key to Netlify environment variables as <code className="bg-amber-100 px-1 rounded">VITE_ANTHROPIC_API_KEY</code> and redeploy.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
