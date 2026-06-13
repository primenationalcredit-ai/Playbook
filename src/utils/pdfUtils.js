// PDF text extraction utility using PDF.js
import * as pdfjsLib from 'pdfjs-dist';

// Use the exact version matching our installed package (5.4.624)
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@5.4.624/build/pdf.worker.min.mjs';

/**
 * Extract text from a PDF file
 * @param {File} file - The PDF file to extract text from
 * @returns {Promise<string>} - The extracted text
 */
export async function extractTextFromPDF(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ 
      data: arrayBuffer,
      useSystemFonts: true,
    });
    
    const pdf = await loadingTask.promise;
    console.log(`PDF loaded: ${pdf.numPages} pages`);
    
    let fullText = '';
    const maxPages = Math.min(pdf.numPages, 50);
    
    for (let i = 1; i <= maxPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map(item => item.str)
          .join(' ')
          .replace(/\s+/g, ' ');
        fullText += pageText + '\n\n';
      } catch (pageErr) {
        console.warn(`Error extracting page ${i}:`, pageErr);
      }
    }
    
    if (pdf.numPages > 50) {
      fullText += `\n\n[Note: Only first 50 of ${pdf.numPages} pages extracted]`;
    }
    
    return fullText.trim();
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw new Error(`Failed to read PDF: ${error.message}`);
  }
}

/**
 * Extract text from PDF in chunks with progress callback
 * @param {File} file - The PDF file
 * @param {number} pagesPerChunk - Pages per chunk (default 25)
 * @param {function} onProgress - Callback with (currentPage, totalPages, percentComplete)
 * @returns {Promise<{chunks: object[], totalPages: number}>}
 */
export async function extractPDFInChunks(file, pagesPerChunk = 25, onProgress = null) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ 
      data: arrayBuffer,
      useSystemFonts: true,
    });
    
    const pdf = await loadingTask.promise;
    const totalPages = pdf.numPages;
    console.log(`PDF loaded for chunking: ${totalPages} pages`);
    
    const chunks = [];
    let currentChunk = '';
    let chunkStartPage = 1;
    
    for (let i = 1; i <= totalPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map(item => item.str)
          .join(' ')
          .replace(/\s+/g, ' ');
        currentChunk += pageText + '\n\n';
        
        // Report progress
        if (onProgress) {
          const percent = Math.round((i / totalPages) * 100);
          onProgress(i, totalPages, percent, 'reading');
        }
        
        // If chunk is full or last page, save it
        if (i % pagesPerChunk === 0 || i === totalPages) {
          if (currentChunk.trim().length > 100) {
            chunks.push({
              text: currentChunk.trim(),
              startPage: chunkStartPage,
              endPage: i,
              pageCount: i - chunkStartPage + 1
            });
          }
          currentChunk = '';
          chunkStartPage = i + 1;
        }
      } catch (pageErr) {
        console.warn(`Error extracting page ${i}:`, pageErr);
      }
    }
    
    return { chunks, totalPages };
  } catch (error) {
    console.error('PDF chunking error:', error);
    throw new Error(`Failed to read PDF: ${error.message}`);
  }
}

/**
 * Check if a file is a PDF
 * @param {File} file - The file to check
 * @returns {boolean}
 */
export function isPDFFile(file) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}
