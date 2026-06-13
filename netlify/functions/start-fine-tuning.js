const fetch = require('node-fetch');
const FormData = require('form-data');

const SUPABASE_URL = 'https://kkcbpqbcpzcarxhknzza.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { userId } = JSON.parse(event.body);

    if (!process.env.OPENAI_API_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'OpenAI API key not configured' })
      };
    }

    // Fetch all pending training examples from database
    const examplesRes = await fetch(
      `${SUPABASE_URL}/rest/v1/ai_training_examples?status=eq.pending&select=user_message,assistant_message`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }}
    );
    
    if (!examplesRes.ok) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to fetch training examples' })
      };
    }

    const examples = await examplesRes.json();
    
    if (!examples || examples.length < 10) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Need at least 10 training examples' })
      };
    }

    // Convert to JSONL format for fine-tuning
    const systemMessage = `You are ASAP AI, the helpful assistant for ASAP Credit Repair USA. You help consultants and employees with accurate information about company processes, pricing, objection handling, scripts, compliance, and more. You are knowledgeable, professional, and always helpful. You speak with confidence and provide detailed, actionable responses.`;

    const jsonlLines = examples.map(ex => JSON.stringify({
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: ex.user_message },
        { role: "assistant", content: ex.assistant_message }
      ]
    }));
    const jsonlContent = jsonlLines.join('\n');

    // Step 1: Upload the training file to OpenAI
    const blob = new Blob([jsonlContent], { type: 'application/jsonl' });
    const formData = new FormData();
    formData.append('purpose', 'fine-tune');
    formData.append('file', Buffer.from(jsonlContent), {
      filename: 'training.jsonl',
      contentType: 'application/jsonl'
    });

    const uploadRes = await fetch('https://api.openai.com/v1/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: formData
    });

    if (!uploadRes.ok) {
      const error = await uploadRes.text();
      console.error('File upload error:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to upload training file', details: error })
      };
    }

    const uploadData = await uploadRes.json();
    const fileId = uploadData.id;

    // Step 2: Create the fine-tuning job
    const fineTuneRes = await fetch('https://api.openai.com/v1/fine_tuning/jobs', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        training_file: fileId,
        model: 'gpt-4o-mini-2024-07-18',
        suffix: 'asap-credit-repair'
      })
    });

    if (!fineTuneRes.ok) {
      const error = await fineTuneRes.text();
      console.error('Fine-tune error:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to start fine-tuning', details: error })
      };
    }

    const fineTuneData = await fineTuneRes.json();
    const jobId = fineTuneData.id;

    // Step 3: Save job info to database
    await fetch(`${SUPABASE_URL}/rest/v1/ai_fine_tuning_jobs`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        job_id: jobId,
        file_id: fileId,
        status: 'running',
        examples_count: examples.length,
        started_by: userId,
        started_at: new Date().toISOString()
      })
    });

    // Step 4: Mark examples as being trained
    const exampleIds = examples.map(e => e.id);
    await fetch(`${SUPABASE_URL}/rest/v1/ai_training_examples?status=eq.pending`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: 'training', training_job_id: jobId })
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        jobId,
        fileId,
        examplesCount: examples.length,
        message: 'Fine-tuning started successfully'
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
