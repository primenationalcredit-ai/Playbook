// Netlify Function for Ask AI
// Optimized for SPEED - fast responses for phone calls

export async function handler(event, context) {
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
    const body = JSON.parse(event.body);
    const { messages, system, mode, knowledgeContext } = body;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'API key not configured in Netlify' }) };
    }

    // Token limits - keep small for speed
    let maxTokens = 800;
    if (mode === 'knowledge_assistant') maxTokens = 1500;
    if (mode === 'parse_document') maxTokens = 2000;

    // Build system prompt
    let finalSystem = system || '';
    
    if (mode === 'ask_ai' && knowledgeContext) {
      finalSystem = `You are ASAP AI for ASAP Credit Repair USA. Be BRIEF and helpful.

${knowledgeContext ? `COMPANY INFO:\n${knowledgeContext}\n\n` : ''}
${system || ''}

RULES: Be concise. Give actionable responses. Never guarantee specific credit score increases.`;
    }

    // Use Haiku for ask_ai mode (faster), Sonnet for document parsing
    const model = mode === 'ask_ai' ? 'claude-3-5-haiku-20241022' : 'claude-sonnet-4-20250514';

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: model,
        max_tokens: maxTokens,
        system: finalSystem,
        messages: messages
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API error:', response.status, errorText);
      return { 
        statusCode: response.status, 
        headers, 
        body: JSON.stringify({ error: `API error: ${response.status}` }) 
      };
    }

    const data = await response.json();
    return { statusCode: 200, headers, body: JSON.stringify(data) };
    
  } catch (error) {
    console.error('Function error:', error);
    return { 
      statusCode: 500, 
      headers, 
      body: JSON.stringify({ error: 'Server error: ' + error.message }) 
    };
  }
}
