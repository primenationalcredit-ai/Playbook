// Netlify Function to parse uploaded documents
import mammoth from 'mammoth';

export async function handler(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { fileContent, fileType, fileName } = JSON.parse(event.body);
    
    if (!fileContent) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'No file content' }) };
    }
    
    const buffer = Buffer.from(fileContent, 'base64');
    let extractedText = '';
    const lowerName = (fileName || '').toLowerCase();
    
    console.log('Processing file:', fileName, 'Type:', fileType, 'Size:', buffer.length);
    
    // Plain text files
    if (lowerName.endsWith('.txt') || lowerName.endsWith('.md') || lowerName.endsWith('.csv')) {
      extractedText = buffer.toString('utf-8');
      console.log('Parsed as text, length:', extractedText.length);
    }
    // Word documents (.docx)
    else if (lowerName.endsWith('.docx')) {
      try {
        const result = await mammoth.extractRawText({ buffer: buffer });
        extractedText = result.value || '';
        console.log('Parsed DOCX with mammoth, length:', extractedText.length);
        
        if (!extractedText || extractedText.length < 10) {
          return { 
            statusCode: 400, 
            headers, 
            body: JSON.stringify({ error: 'Word document appears to be empty or could not be read.' }) 
          };
        }
      } catch (docxErr) {
        console.error('Mammoth error:', docxErr);
        return { 
          statusCode: 400, 
          headers, 
          body: JSON.stringify({ error: 'Could not read Word document: ' + docxErr.message }) 
        };
      }
    }
    // Old .doc format
    else if (lowerName.endsWith('.doc')) {
      return { 
        statusCode: 400, 
        headers, 
        body: JSON.stringify({ error: 'Old .doc format not supported. Please save as .docx or .txt first.' }) 
      };
    }
    // PDF - basic attempt
    else if (lowerName.endsWith('.pdf')) {
      return { 
        statusCode: 400, 
        headers, 
        body: JSON.stringify({ error: 'PDF parsing not available. Please copy the text from the PDF and paste it instead.' }) 
      };
    }
    // Try as plain text
    else {
      try {
        extractedText = buffer.toString('utf-8');
        if (!/[a-zA-Z]{3,}/.test(extractedText.substring(0, 500))) {
          return { 
            statusCode: 400, 
            headers, 
            body: JSON.stringify({ error: 'Could not read this file type. Try .docx, .txt, or paste the content.' }) 
          };
        }
      } catch {
        return { 
          statusCode: 400, 
          headers, 
          body: JSON.stringify({ error: 'Unsupported file type.' }) 
        };
      }
    }

    // Clean up
    extractedText = extractedText
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{4,}/g, '\n\n\n')
      .trim();

    if (extractedText.length < 10) {
      return { 
        statusCode: 400, 
        headers, 
        body: JSON.stringify({ error: 'Document appears empty.' }) 
      };
    }

    console.log('Success, returning', extractedText.length, 'chars');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        text: extractedText.substring(0, 50000),
        charCount: extractedText.length,
        truncated: extractedText.length > 50000
      })
    };
  } catch (error) {
    console.error('Parse error:', error);
    return { 
      statusCode: 500, 
      headers, 
      body: JSON.stringify({ error: 'Server error: ' + error.message }) 
    };
  }
}
