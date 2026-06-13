import React, { useState, useRef } from 'react';
import { 
  FileText, Upload, Loader, CheckCircle, XCircle, 
  Play, Pause, RotateCcw, X, AlertCircle
} from 'lucide-react';
import { extractPDFInChunks, isPDFFile } from '../utils/pdfUtils';

/**
 * ChunkedPDFProcessor - Processes large PDFs in chunks with progress tracking
 * 
 * Props:
 * - onChunkProcessed: (chunkData, chunkIndex, totalChunks) => Promise<results>
 * - onAllComplete: (allResults) => void
 * - onClose: () => void
 * - title: string (optional)
 * - processButtonText: string (optional)
 */
export default function ChunkedPDFProcessor({ 
  onChunkProcessed, 
  onAllComplete, 
  onClose,
  title = "Process Large Document",
  processButtonText = "Start Processing"
}) {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle'); // idle, reading, processing, complete, error
  const [progress, setProgress] = useState({ 
    phase: '', 
    current: 0, 
    total: 0, 
    percent: 0,
    currentChunk: 0,
    totalChunks: 0,
    chunksProcessed: 0
  });
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const pausedRef = useRef(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    if (!isPDFFile(selectedFile)) {
      setError('Please select a PDF file');
      return;
    }
    
    setFile(selectedFile);
    setError(null);
    setStatus('idle');
    setResults([]);
    setProgress({ phase: '', current: 0, total: 0, percent: 0, currentChunk: 0, totalChunks: 0, chunksProcessed: 0 });
  };

  const startProcessing = async () => {
    if (!file) return;
    
    setStatus('reading');
    setError(null);
    setResults([]);
    pausedRef.current = false;
    setIsPaused(false);
    
    try {
      // Step 1: Extract PDF in chunks
      setProgress(p => ({ ...p, phase: 'Reading PDF...', percent: 0 }));
      
      const { chunks, totalPages } = await extractPDFInChunks(file, 15, (currentPage, total, percent) => {
        setProgress(p => ({ 
          ...p, 
          phase: `Reading page ${currentPage} of ${total}...`,
          current: currentPage,
          total: total,
          percent: Math.round(percent * 0.3) // Reading is 30% of total
        }));
      });
      
      if (chunks.length === 0) {
        throw new Error('Could not extract any text from this PDF. It may be a scanned image.');
      }
      
      console.log(`Extracted ${chunks.length} chunks from ${totalPages} pages`);
      
      // Step 2: Process each chunk through AI
      setStatus('processing');
      const allResults = [];
      
      for (let i = 0; i < chunks.length; i++) {
        // Check if paused
        while (pausedRef.current) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        const chunk = chunks[i];
        setProgress(p => ({
          ...p,
          phase: `Processing chunk ${i + 1} of ${chunks.length} (pages ${chunk.startPage}-${chunk.endPage})...`,
          currentChunk: i + 1,
          totalChunks: chunks.length,
          chunksProcessed: i,
          percent: 30 + Math.round(((i + 0.5) / chunks.length) * 70)
        }));
        
        try {
          const chunkResults = await onChunkProcessed(chunk, i, chunks.length);
          if (chunkResults) {
            allResults.push({
              chunkIndex: i,
              pages: `${chunk.startPage}-${chunk.endPage}`,
              results: chunkResults
            });
            setResults([...allResults]);
          }
        } catch (chunkErr) {
          console.error(`Error processing chunk ${i}:`, chunkErr);
          // Continue with other chunks
        }
        
        setProgress(p => ({
          ...p,
          chunksProcessed: i + 1,
          percent: 30 + Math.round(((i + 1) / chunks.length) * 70)
        }));
      }
      
      // Complete
      setStatus('complete');
      setProgress(p => ({ ...p, phase: 'Complete!', percent: 100 }));
      
      if (onAllComplete) {
        onAllComplete(allResults);
      }
      
    } catch (err) {
      console.error('Processing error:', err);
      setError(err.message || 'Failed to process document');
      setStatus('error');
    }
  };

  const togglePause = () => {
    pausedRef.current = !pausedRef.current;
    setIsPaused(!isPaused);
  };

  const resetProcessor = () => {
    setFile(null);
    setStatus('idle');
    setProgress({ phase: '', current: 0, total: 0, percent: 0, currentChunk: 0, totalChunks: 0, chunksProcessed: 0 });
    setResults([]);
    setError(null);
    setIsPaused(false);
    pausedRef.current = false;
  };

  const totalResultsCount = results.reduce((sum, r) => sum + (r.results?.length || 0), 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-purple-600 to-indigo-600">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-white" />
            <h2 className="text-lg font-semibold text-white">{title}</h2>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* File Selection */}
          {status === 'idle' && (
            <div className="space-y-4">
              <p className="text-slate-600">
                Upload a large PDF and we'll automatically process it in chunks. 
                You can walk away — progress is tracked and results accumulate as each section completes.
              </p>
              
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  file ? 'border-purple-300 bg-purple-50' : 'border-slate-300 hover:border-purple-400 hover:bg-purple-50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {file ? (
                  <>
                    <FileText size={40} className="mx-auto mb-3 text-purple-500" />
                    <p className="font-medium text-purple-700">{file.name}</p>
                    <p className="text-sm text-purple-500 mt-1">
                      {(file.size / 1024 / 1024).toFixed(1)} MB • Click to change
                    </p>
                  </>
                ) : (
                  <>
                    <Upload size={40} className="mx-auto mb-3 text-slate-400" />
                    <p className="font-medium text-slate-600">Click to select a PDF</p>
                    <p className="text-sm text-slate-400 mt-1">Large files (100+ pages) are OK!</p>
                  </>
                )}
              </div>
              
              {error && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
                  <AlertCircle size={18} />
                  <span className="text-sm">{error}</span>
                </div>
              )}
              
              {file && (
                <button
                  onClick={startProcessing}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-medium hover:from-purple-700 hover:to-indigo-700"
                >
                  <Play size={18} />
                  {processButtonText}
                </button>
              )}
            </div>
          )}
          
          {/* Processing Progress */}
          {(status === 'reading' || status === 'processing') && (
            <div className="space-y-6">
              <div className="text-center">
                <Loader size={48} className="mx-auto mb-4 text-purple-600 animate-spin" />
                <p className="font-medium text-slate-700">{progress.phase}</p>
                {isPaused && <p className="text-amber-600 text-sm mt-1">Paused</p>}
              </div>
              
              {/* Progress Bar */}
              <div>
                <div className="flex justify-between text-sm text-slate-600 mb-2">
                  <span>Progress</span>
                  <span>{progress.percent}%</span>
                </div>
                <div className="h-4 bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-500"
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
              </div>
              
              {/* Chunk Progress */}
              {status === 'processing' && progress.totalChunks > 0 && (
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-600">Chunks processed</span>
                    <span className="font-medium">{progress.chunksProcessed} / {progress.totalChunks}</span>
                  </div>
                  <div className="flex gap-1">
                    {Array.from({ length: progress.totalChunks }).map((_, i) => (
                      <div 
                        key={i}
                        className={`flex-1 h-2 rounded-full ${
                          i < progress.chunksProcessed ? 'bg-green-500' : 
                          i === progress.chunksProcessed ? 'bg-purple-500 animate-pulse' : 
                          'bg-slate-300'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}
              
              {/* Results So Far */}
              {totalResultsCount > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-green-700 font-medium">
                    ✓ {totalResultsCount} items extracted so far
                  </p>
                  <p className="text-green-600 text-sm">
                    From {results.length} chunks processed
                  </p>
                </div>
              )}
              
              {/* Pause/Resume */}
              <button
                onClick={togglePause}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium ${
                  isPaused 
                    ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                    : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                }`}
              >
                {isPaused ? <Play size={16} /> : <Pause size={16} />}
                {isPaused ? 'Resume Processing' : 'Pause Processing'}
              </button>
            </div>
          )}
          
          {/* Complete */}
          {status === 'complete' && (
            <div className="space-y-6">
              <div className="text-center">
                <CheckCircle size={48} className="mx-auto mb-4 text-green-500" />
                <h3 className="text-xl font-semibold text-slate-800">Processing Complete!</h3>
                <p className="text-slate-600 mt-1">
                  Extracted {totalResultsCount} items from {results.length} sections
                </p>
              </div>
              
              {/* Results Summary */}
              <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                {results.map((r, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-slate-600">Pages {r.pages}</span>
                    <span className="font-medium text-slate-800">{r.results?.length || 0} items</span>
                  </div>
                ))}
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={resetProcessor}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
                >
                  <RotateCcw size={16} />
                  Process Another
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  <CheckCircle size={16} />
                  Done
                </button>
              </div>
            </div>
          )}
          
          {/* Error */}
          {status === 'error' && (
            <div className="space-y-4">
              <div className="text-center">
                <XCircle size={48} className="mx-auto mb-4 text-red-500" />
                <h3 className="text-xl font-semibold text-slate-800">Processing Failed</h3>
                <p className="text-red-600 mt-1">{error}</p>
              </div>
              
              {totalResultsCount > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-amber-700">
                    {totalResultsCount} items were extracted before the error. 
                    These have been saved.
                  </p>
                </div>
              )}
              
              <button
                onClick={resetProcessor}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
              >
                <RotateCcw size={16} />
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
