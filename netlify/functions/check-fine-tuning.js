const fetch = require('node-fetch');

const SUPABASE_URL = 'https://kkcbpqbcpzcarxhknzza.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    if (!process.env.OPENAI_API_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'OpenAI API key not configured' })
      };
    }

    // Fetch running jobs from database
    const jobsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/ai_fine_tuning_jobs?status=eq.running&select=*`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }}
    );
    
    if (!jobsRes.ok) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to fetch jobs' })
      };
    }

    const jobs = await jobsRes.json();
    const results = [];

    for (const job of jobs) {
      // Check status with OpenAI
      const statusRes = await fetch(`https://api.openai.com/v1/fine_tuning/jobs/${job.job_id}`, {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        }
      });

      if (!statusRes.ok) {
        results.push({ jobId: job.job_id, error: 'Failed to check status' });
        continue;
      }

      const statusData = await statusRes.json();
      
      if (statusData.status === 'succeeded') {
        // Job completed! Update database with the new model ID
        const fineTunedModel = statusData.fine_tuned_model;
        
        // Update job status
        await fetch(`${SUPABASE_URL}/rest/v1/ai_fine_tuning_jobs?job_id=eq.${job.job_id}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            status: 'completed',
            model_id: fineTunedModel,
            completed_at: new Date().toISOString()
          })
        });

        // Save as active model
        await fetch(`${SUPABASE_URL}/rest/v1/ai_model_info`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            model_id: fineTunedModel,
            job_id: job.job_id,
            status: 'active',
            examples_trained: job.examples_count
          })
        });

        // Mark training examples as trained
        await fetch(`${SUPABASE_URL}/rest/v1/ai_training_examples?training_job_id=eq.${job.job_id}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status: 'trained' })
        });

        results.push({ 
          jobId: job.job_id, 
          status: 'completed', 
          model: fineTunedModel 
        });
      } else if (statusData.status === 'failed') {
        // Job failed
        await fetch(`${SUPABASE_URL}/rest/v1/ai_fine_tuning_jobs?job_id=eq.${job.job_id}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            status: 'failed',
            error: statusData.error?.message || 'Unknown error'
          })
        });

        // Reset examples to pending
        await fetch(`${SUPABASE_URL}/rest/v1/ai_training_examples?training_job_id=eq.${job.job_id}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status: 'pending', training_job_id: null })
        });

        results.push({ 
          jobId: job.job_id, 
          status: 'failed', 
          error: statusData.error?.message 
        });
      } else {
        results.push({ 
          jobId: job.job_id, 
          status: statusData.status 
        });
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobs: results })
    };

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error', message: error.message })
    };
  }
};
