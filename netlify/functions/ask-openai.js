const fetch = require('node-fetch');

const SUPABASE_URL = 'https://kkcbpqbcpzcarxhknzza.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0';

// Get the active fine-tuned model (if any)
async function getActiveModel() {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/ai_model_info?status=eq.active&select=model_id&order=created_at.desc&limit=1`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }}
    );
    if (res.ok) {
      const models = await res.json();
      if (models?.length > 0) {
        return models[0].model_id; // Return the fine-tuned model ID
      }
    }
  } catch (err) {
    console.error('Failed to fetch model:', err);
  }
  return 'gpt-4o-mini'; // Fallback to base model
}

// Fetch any additional training instructions (for things added after last fine-tune)
async function getRecentTraining() {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/ai_training?is_active=eq.true&select=instruction,category&order=priority.desc`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }}
    );
    if (res.ok) {
      return await res.json() || [];
    }
  } catch (err) {
    console.error('Failed to fetch training:', err);
  }
  return [];
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { messages, companyContext, kbContext, systemPrompt: additionalPrompt } = JSON.parse(event.body);

    if (!process.env.OPENAI_API_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'OpenAI API key not configured' })
      };
    }

    // Get the active model (fine-tuned or base)
    const model = await getActiveModel();
    const isFineTuned = model.startsWith('ft:');
    
    // Get any recent training instructions
    const recentTraining = await getRecentTraining();

    // Build system prompt
    let systemPrompt = `You are ASAP AI, the helpful assistant for ASAP Credit Repair USA. You help consultants and employees with accurate information about company processes, pricing, objection handling, scripts, compliance, and more.`;

    // If using base model, add more context
    if (!isFineTuned) {
      systemPrompt += `\n\nYou are knowledgeable, professional, and always helpful. You speak with confidence and provide detailed, actionable responses.`;
    }

    // Add any recent training instructions (for knowledge added after last fine-tune)
    if (recentTraining.length > 0) {
      systemPrompt += `\n\nIMPORTANT INSTRUCTIONS:\n`;
      recentTraining.forEach(t => {
        systemPrompt += `- ${t.instruction}\n`;
      });
    }

    // Add any provided context
    if (companyContext) {
      systemPrompt += `\n\nCompany Information:\n${companyContext}`;
    }
    if (kbContext) {
      systemPrompt += `\n\nRelevant Knowledge:\n${kbContext}`;
    }
    if (additionalPrompt) {
      systemPrompt += `\n\n${additionalPrompt}`;
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        max_tokens: 1000,
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
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: data.choices[0]?.message?.content || 'No response generated',
        usage: data.usage,
        model: model,
        isFineTuned: isFineTuned
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
