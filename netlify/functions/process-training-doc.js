const fetch = require('node-fetch');

// Process document text and extract training examples using GPT-4
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { content, filename, fileType } = JSON.parse(event.body);

    if (!process.env.OPENAI_API_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'OpenAI API key not configured' })
      };
    }

    if (!content || content.trim().length < 50) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Document content is too short or empty.' })
      };
    }

    // Use GPT-4 to extract training examples from the document
    const systemPrompt = `You are an AI that extracts training examples from documents for a credit repair company called ASAP Credit Repair USA.

Your job is to read the document and create question-answer pairs that can be used to train a custom AI assistant for their employees.

RULES:
1. Create realistic questions that employees/consultants might ask
2. Answers should be detailed, helpful, and match the company's confident, professional voice
3. Include variations of questions (different phrasings for same topic)
4. Focus on actionable information employees can use
5. Extract: pricing details, processes, scripts, objection handling, compliance info, company facts
6. Each example should be self-contained and useful on its own
7. If it's a script, create examples like "How should I respond when..." or "What's the script for..."
8. For processes, create "How do I..." or "What are the steps to..." questions
9. Include the key details and language from the document in your answers

OUTPUT FORMAT - Return ONLY valid JSON array, no markdown, no code blocks, no explanation:
[
  {
    "user": "What is the question someone might ask?",
    "assistant": "The detailed, helpful response the AI should give."
  }
]

Create 15-25 training examples from the document. Focus on the most important, actionable information.`;

    // Truncate content if too long (keep first 12000 chars for processing)
    const truncatedContent = content.substring(0, 12000);

    console.log(`Processing document: ${filename}, ${content.length} chars`);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Document: ${filename}\n\nContent:\n${truncatedContent}` }
        ],
        max_tokens: 4000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI error:', error);
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: 'OpenAI API error', details: error })
      };
    }

    const data = await response.json();
    const contentResponse = data.choices[0]?.message?.content || '[]';
    
    // Parse the JSON response
    let examples = [];
    try {
      // Clean up the response (remove markdown code blocks if present)
      let cleanJson = contentResponse.trim();
      if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      }
      examples = JSON.parse(cleanJson);
    } catch (parseErr) {
      console.error('Failed to parse examples:', parseErr);
      console.error('Raw response:', contentResponse.substring(0, 500));
      // Try to extract JSON array from response
      const match = contentResponse.match(/\[[\s\S]*\]/);
      if (match) {
        try {
          examples = JSON.parse(match[0]);
        } catch (e) {
          console.error('Secondary parse also failed');
          examples = [];
        }
      }
    }

    console.log(`Extracted ${examples.length} examples from ${filename}`);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        examples,
        filename,
        extracted_count: examples.length,
        text_length: content.length
      })
    };

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error', message: error.message })
    };
  }
};
