import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Sparkles, Plus, Trash2, Edit2, Check, X, Loader, Upload,
  FileText, MessageSquare, BookOpen, Brain, Zap, AlertCircle,
  ChevronDown, ChevronUp, Play, RefreshCw, Download, Eye, Layers
} from 'lucide-react';
import { extractTextFromPDF, isPDFFile } from '../utils/pdfUtils';
import ChunkedPDFProcessor from '../components/ChunkedPDFProcessor';

const SUPABASE_URL = 'https://kkcbpqbcpzcarxhknzza.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0';

export default function AITrainingHub() {
  const { currentUser } = useApp();
  const [activeTab, setActiveTab] = useState('examples');
  const [trainingExamples, setTrainingExamples] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [modelInfo, setModelInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showChunkedProcessor, setShowChunkedProcessor] = useState(false);
  
  // New example form
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  const [addingExample, setAddingExample] = useState(false);
  
  // Document upload
  const [uploadedFile, setUploadedFile] = useState(null);
  const [docProcessing, setDocProcessing] = useState(false);
  
  const isAdmin = currentUser?.role === 'admin' || currentUser?.department === 'leadership';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load training examples
      const exRes = await fetch(
        `${SUPABASE_URL}/rest/v1/ai_training_examples?select=*&order=created_at.desc`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }}
      );
      if (exRes.ok) setTrainingExamples(await exRes.json() || []);

      // Load processed documents
      const docRes = await fetch(
        `${SUPABASE_URL}/rest/v1/ai_training_documents?select=*&order=created_at.desc`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }}
      );
      if (docRes.ok) setDocuments(await docRes.json() || []);

      // Load model info
      const modelRes = await fetch(
        `${SUPABASE_URL}/rest/v1/ai_model_info?select=*&order=created_at.desc&limit=1`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }}
      );
      if (modelRes.ok) {
        const models = await modelRes.json();
        if (models?.length > 0) setModelInfo(models[0]);
      }
    } catch (err) {
      console.error('Failed to load:', err);
    } finally {
      setLoading(false);
    }
  };

  // Add a Q&A training example
  const addExample = async () => {
    if (!newQuestion.trim() || !newAnswer.trim()) return;
    
    setAddingExample(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/ai_training_examples`, {
        method: 'POST',
        headers: { 
          'apikey': SUPABASE_KEY, 
          'Authorization': `Bearer ${SUPABASE_KEY}`, 
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          user_message: newQuestion.trim(),
          assistant_message: newAnswer.trim(),
          source: 'manual',
          created_by: currentUser?.name,
          status: 'pending'
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        setTrainingExamples(prev => [data[0], ...prev]);
        setNewQuestion('');
        setNewAnswer('');
      }
    } catch (err) {
      console.error('Failed to add:', err);
      alert('Failed to add example');
    } finally {
      setAddingExample(false);
    }
  };

  // Delete example
  const deleteExample = async (id) => {
    if (!confirm('Delete this training example?')) return;
    
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/ai_training_examples?id=eq.${id}`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      setTrainingExamples(prev => prev.filter(e => e.id !== id));
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  // Process uploaded document with AI to extract training examples
  const processDocument = async () => {
    if (!uploadedFile) return;
    
    setDocProcessing(true);
    try {
      const isPDF = isPDFFile(uploadedFile);
      
      let textContent = '';
      
      if (isPDF) {
        // Extract text from PDF on client side
        try {
          textContent = await extractTextFromPDF(uploadedFile);
          console.log(`Extracted ${textContent.length} characters from PDF`);
          
          if (!textContent || textContent.trim().length < 50) {
            alert('Could not extract text from this PDF.\n\nPossible reasons:\n• PDF is a scanned image\n• PDF is encrypted\n• No text content\n\nTry copy/paste instead.');
            setDocProcessing(false);
            return;
          }
        } catch (pdfErr) {
          console.error('PDF extraction error:', pdfErr);
          alert(`Failed to read PDF: ${pdfErr.message}\n\nTry a smaller file or copy/paste the text.`);
          setDocProcessing(false);
          return;
        }
      } else {
        // Read text files directly
        textContent = await uploadedFile.text();
      }
      
      // Send extracted text to backend for AI processing
      const res = await fetch('/.netlify/functions/process-training-doc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: textContent,
          filename: uploadedFile.name,
          fileType: isPDF ? 'pdf' : 'text'
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        
        // Save document record
        await fetch(`${SUPABASE_URL}/rest/v1/ai_training_documents`, {
          method: 'POST',
          headers: { 
            'apikey': SUPABASE_KEY, 
            'Authorization': `Bearer ${SUPABASE_KEY}`, 
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            filename: uploadedFile.name,
            content_preview: textContent.substring(0, 500),
            examples_generated: data.examples?.length || 0,
            processed_by: currentUser?.name,
            status: 'processed'
          })
        });
        
        // Save extracted examples
        if (data.examples?.length > 0) {
          for (const ex of data.examples) {
            await fetch(`${SUPABASE_URL}/rest/v1/ai_training_examples`, {
              method: 'POST',
              headers: { 
                'apikey': SUPABASE_KEY, 
                'Authorization': `Bearer ${SUPABASE_KEY}`, 
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                user_message: ex.user,
                assistant_message: ex.assistant,
                source: 'document',
                source_document: uploadedFile.name,
                created_by: currentUser?.name,
                status: 'pending'
              })
            });
          }
        }
        
        alert(`Document processed! Extracted ${data.examples?.length || 0} training examples.`);
        setUploadedFile(null);
        loadData();
      } else {
        const err = await res.json();
        alert(`Failed to process: ${err.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Failed to process:', err);
      alert('Failed to process document');
    } finally {
      setDocProcessing(false);
    }
  };

  // Process a single chunk from large PDF for training examples
  const processTrainingChunk = async (chunk, chunkIndex, totalChunks) => {
    try {
      const res = await fetch('/.netlify/functions/process-training-doc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: chunk.text,
          filename: `Chunk ${chunkIndex + 1} (pages ${chunk.startPage}-${chunk.endPage})`,
          fileType: 'text'
        })
      });
      
      if (!res.ok) throw new Error('Processing failed');
      const data = await res.json();
      
      if (data.examples?.length > 0) {
        // Save examples to database
        for (const ex of data.examples) {
          await fetch(`${SUPABASE_URL}/rest/v1/ai_training_examples`, {
            method: 'POST',
            headers: { 
              'apikey': SUPABASE_KEY, 
              'Authorization': `Bearer ${SUPABASE_KEY}`, 
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              user_message: ex.user,
              assistant_message: ex.assistant,
              source: 'document',
              source_document: `Large PDF - Pages ${chunk.startPage}-${chunk.endPage}`,
              created_by: currentUser?.name,
              status: 'pending'
            })
          });
        }
        return data.examples;
      }
      return [];
    } catch (e) {
      console.error('Chunk training error:', e);
      return [];
    }
  };

  // When all training chunks are processed
  const onTrainingChunksComplete = (allResults) => {
    const totalExamples = allResults.reduce((sum, r) => sum + (r.results?.length || 0), 0);
    loadData(); // Refresh the list
    alert(`✓ Processing complete!\n\n${totalExamples} training examples created from ${allResults.length} document sections.\n\nYou can now review them and start fine-tuning when ready.`);
  };

  // Trigger fine-tuning
  const startFineTuning = async () => {
    const pendingCount = trainingExamples.filter(e => e.status === 'pending').length;
    if (pendingCount < 10) {
      alert('You need at least 10 training examples to fine-tune. Add more examples.');
      return;
    }
    
    if (!confirm(`Start fine-tuning with ${pendingCount} examples? This will cost approximately $${(pendingCount * 0.008).toFixed(2)} and take 10-30 minutes.`)) {
      return;
    }
    
    setProcessing(true);
    try {
      const res = await fetch('/.netlify/functions/start-fine-tuning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser?.id })
      });
      
      if (res.ok) {
        const data = await res.json();
        alert(`Fine-tuning started! Job ID: ${data.jobId}\n\nThis will take 10-30 minutes. Check back soon.`);
        loadData();
      } else {
        const err = await res.json();
        alert(`Failed: ${err.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Failed:', err);
      alert('Failed to start fine-tuning');
    } finally {
      setProcessing(false);
    }
  };

  // Export training data as JSONL
  const exportTrainingData = () => {
    const jsonl = trainingExamples
      .filter(e => e.status === 'pending' || e.status === 'approved')
      .map(e => JSON.stringify({
        messages: [
          { role: "system", content: "You are ASAP AI, the helpful assistant for ASAP Credit Repair USA. You help consultants with accurate information about company processes, pricing, objection handling, and more." },
          { role: "user", content: e.user_message },
          { role: "assistant", content: e.assistant_message }
        ]
      }))
      .join('\n');
    
    const blob = new Blob([jsonl], { type: 'application/jsonl' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `asap-training-${new Date().toISOString().split('T')[0]}.jsonl`;
    a.click();
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

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <Loader className="animate-spin text-purple-600" size={32} />
      </div>
    );
  }

  const pendingExamples = trainingExamples.filter(e => e.status === 'pending').length;
  const trainedExamples = trainingExamples.filter(e => e.status === 'trained').length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Brain className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">AI Training Hub</h1>
              <p className="text-slate-500">Train your custom ASAP AI model</p>
            </div>
          </div>
        </div>

        {/* Model Status */}
        <div className={`rounded-2xl p-5 mb-6 ${modelInfo?.status === 'active' ? 'bg-green-50 border-2 border-green-200' : 'bg-slate-50 border-2 border-slate-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${modelInfo?.status === 'active' ? 'bg-green-100' : 'bg-slate-200'}`}>
                <Zap size={24} className={modelInfo?.status === 'active' ? 'text-green-600' : 'text-slate-400'} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">
                  {modelInfo?.status === 'active' ? 'Custom Model Active' : 'No Custom Model Yet'}
                </h3>
                <p className="text-sm text-slate-500">
                  {modelInfo?.status === 'active' 
                    ? `Model: ${modelInfo.model_id} • Trained: ${new Date(modelInfo.created_at).toLocaleDateString()}`
                    : 'Add training examples and run fine-tuning to create your custom model'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-2xl font-bold text-slate-800">{pendingExamples}</p>
                <p className="text-xs text-slate-500">Ready to train</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-slate-800">{trainedExamples}</p>
                <p className="text-xs text-slate-500">Already trained</p>
              </div>
            </div>
          </div>
          
          {pendingExamples >= 10 && (
            <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between">
              <p className="text-sm text-slate-600">
                <strong>{pendingExamples} examples</strong> ready for training. Estimated cost: ~${(pendingExamples * 0.008).toFixed(2)}
              </p>
              <button
                onClick={startFineTuning}
                disabled={processing}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold hover:from-purple-700 hover:to-pink-700 disabled:opacity-50"
              >
                {processing ? <Loader size={18} className="animate-spin" /> : <Play size={18} />}
                Start Fine-Tuning
              </button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('examples')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
              activeTab === 'examples' 
                ? 'bg-purple-100 text-purple-700' 
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            <MessageSquare size={18} />
            Training Examples ({trainingExamples.length})
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
              activeTab === 'documents' 
                ? 'bg-purple-100 text-purple-700' 
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileText size={18} />
            Upload Documents ({documents.length})
          </button>
          <button
            onClick={() => setActiveTab('how')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
              activeTab === 'how' 
                ? 'bg-purple-100 text-purple-700' 
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            <BookOpen size={18} />
            How It Works
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'examples' && (
          <div className="space-y-6">
            {/* Add New Example */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Plus size={18} className="text-purple-600" />
                Add Training Example
              </h3>
              <p className="text-sm text-slate-500 mb-4">
                Teach the AI how to respond. Enter a question someone might ask, and the ideal response.
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    User Question / Input
                  </label>
                  <textarea
                    value={newQuestion}
                    onChange={(e) => setNewQuestion(e.target.value)}
                    placeholder="e.g., What makes ASAP different from other credit repair companies?"
                    rows={2}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Ideal AI Response
                  </label>
                  <textarea
                    value={newAnswer}
                    onChange={(e) => setNewAnswer(e.target.value)}
                    placeholder="e.g., Great question! What sets ASAP apart is our documentation-based approach. Unlike other companies that use template dispute letters, we request specific documents from creditors to build stronger cases..."
                    rows={4}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                
                <button
                  onClick={addExample}
                  disabled={!newQuestion.trim() || !newAnswer.trim() || addingExample}
                  className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 disabled:opacity-50"
                >
                  {addingExample ? <Loader size={16} className="animate-spin" /> : <Plus size={16} />}
                  Add Training Example
                </button>
              </div>
            </div>

            {/* Examples List */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-semibold text-slate-800">Training Examples</h3>
                <button
                  onClick={exportTrainingData}
                  className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700"
                >
                  <Download size={14} />
                  Export JSONL
                </button>
              </div>
              
              <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                {trainingExamples.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    <MessageSquare size={32} className="mx-auto mb-2 text-slate-300" />
                    <p>No training examples yet. Add some above!</p>
                  </div>
                ) : (
                  trainingExamples.map(ex => (
                    <div key={ex.id} className="p-4 hover:bg-slate-50">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div>
                            <span className="text-xs font-medium text-slate-400 uppercase">User:</span>
                            <p className="text-slate-800">{ex.user_message}</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-slate-400 uppercase">AI Response:</span>
                            <p className="text-slate-600 text-sm">{ex.assistant_message}</p>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <span className={`px-2 py-0.5 rounded-full ${
                              ex.status === 'trained' ? 'bg-green-100 text-green-700' :
                              ex.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {ex.status}
                            </span>
                            <span>•</span>
                            <span>{ex.source === 'document' ? `From: ${ex.source_document}` : 'Manual entry'}</span>
                            <span>•</span>
                            <span>{new Date(ex.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => deleteExample(ex.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="space-y-6">
            {/* Upload Document */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Upload size={18} className="text-purple-600" />
                Upload Training Document
              </h3>
              <p className="text-sm text-slate-500 mb-4">
                Upload a document (training material, scripts, processes) and AI will extract training examples from it.
              </p>
              
              <div className="space-y-4">
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-purple-300 transition-colors">
                  <input
                    type="file"
                    accept=".txt,.md,.doc,.docx,.pdf"
                    onChange={(e) => setUploadedFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="doc-upload"
                  />
                  <label htmlFor="doc-upload" className="cursor-pointer">
                    <FileText size={32} className="mx-auto mb-2 text-slate-400" />
                    {uploadedFile ? (
                      <div>
                        <p className="text-slate-800 font-medium">{uploadedFile.name}</p>
                        <p className="text-sm text-slate-500">{(uploadedFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-slate-700 font-medium">Click to upload a document</p>
                        <p className="text-sm text-slate-500">PDF, TXT, MD, DOCX supported</p>
                      </div>
                    )}
                  </label>
                </div>
                
                {uploadedFile && (
                  <button
                    onClick={processDocument}
                    disabled={docProcessing}
                    className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 disabled:opacity-50 w-full justify-center"
                  >
                    {docProcessing ? <Loader size={16} className="animate-spin" /> : <Zap size={16} />}
                    {docProcessing ? 'Reading document & extracting training examples...' : 'Process Document & Extract Examples'}
                  </button>
                )}
              </div>
            </div>

            {/* Large PDF Processing */}
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl border border-indigo-200 p-5">
              <h3 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
                <Layers size={18} className="text-indigo-600" />
                Process Large PDF (100+ pages)
              </h3>
              <p className="text-sm text-slate-600 mb-4">
                For large training documents, we'll automatically split it into sections and process each one. You can walk away while it runs.
              </p>
              <button
                onClick={() => setShowChunkedProcessor(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium hover:from-indigo-700 hover:to-purple-700 w-full justify-center"
              >
                <Layers size={16} />
                Process Large PDF
              </button>
            </div>

            {/* Documents List */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="font-semibold text-slate-800">Processed Documents</h3>
              </div>
              
              <div className="divide-y divide-slate-100">
                {documents.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    <FileText size={32} className="mx-auto mb-2 text-slate-300" />
                    <p>No documents processed yet.</p>
                  </div>
                ) : (
                  documents.map(doc => (
                    <div key={doc.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-slate-800">{doc.filename}</p>
                          <p className="text-sm text-slate-500">
                            {doc.examples_generated} examples extracted • {new Date(doc.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          doc.status === 'processed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {doc.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'how' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-800 mb-4 text-lg">How AI Training Works</h3>
            
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="font-bold text-purple-600">1</span>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-800">Add Training Examples</h4>
                  <p className="text-slate-600">Either manually enter Q&A pairs, or upload documents for AI to extract examples. Each example teaches the AI how to respond to specific questions.</p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="font-bold text-purple-600">2</span>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-800">Fine-Tune the Model</h4>
                  <p className="text-slate-600">Once you have 10+ examples, click "Start Fine-Tuning". OpenAI will train a custom model specifically for ASAP. This takes 10-30 minutes and costs about $0.008 per example.</p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="font-bold text-purple-600">3</span>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-800">AI Learns Permanently</h4>
                  <p className="text-slate-600">Your custom model permanently "knows" the training examples. It doesn't search a database — it actually learned the information, like a trained employee.</p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="font-bold text-purple-600">4</span>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-800">Continuous Improvement</h4>
                  <p className="text-slate-600">Keep adding examples and re-training periodically. The more you teach, the smarter your AI gets. Corrections from Ask AI can be converted to training examples.</p>
                </div>
              </div>
              
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-6">
                <h4 className="font-semibold text-amber-800 flex items-center gap-2">
                  <AlertCircle size={18} />
                  Tips for Good Training
                </h4>
                <ul className="mt-2 space-y-1 text-sm text-amber-700">
                  <li>• Be specific and detailed in responses</li>
                  <li>• Include various phrasings of the same question</li>
                  <li>• Cover edge cases and objections</li>
                  <li>• Use the exact tone and language you want the AI to use</li>
                  <li>• More examples = better learning (aim for 50-100+)</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Chunked PDF Processor Modal */}
      {showChunkedProcessor && (
        <ChunkedPDFProcessor
          title="Process Large Training Document"
          processButtonText="Extract Training Examples"
          onChunkProcessed={processTrainingChunk}
          onAllComplete={onTrainingChunksComplete}
          onClose={() => setShowChunkedProcessor(false)}
        />
      )}
    </div>
  );
}
