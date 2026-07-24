// Netlify function to receive Google reviews from Zapier
// Endpoint: /.netlify/functions/google-review-webhook

const SUPABASE_URL = 'https://kkcbpqbcpzcarxhknzza.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY2JwcWJjcHpjYXJ4aGtuenphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAzNjAsImV4cCI6MjA4Mjk0NjM2MH0.xdBXVquwL3gV8MU7cFL8kqadDoXlAg-RfZgPk2icRy0';

exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Api-Key',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    console.log('Raw body:', event.body);
    
    // Parse the incoming review data from Zapier
    let data;
    try {
      data = JSON.parse(event.body);
    } catch (parseError) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Invalid JSON', 
          details: parseError.message,
        }),
      };
    }
    
    console.log('Parsed data:', JSON.stringify(data));

    const {
      location_name: location_name_raw,
      reviewer_name,
      rating,
      review_text,
      review_date,
      review_id,
      profile_photo_url,
    } = data;
    // Trim trailing/leading spaces so the same location never splits into "New York" vs "New York "
    // (a trailing space silently breaks the location filter on the reviews page).
    const location_name = (location_name_raw || '').trim();

    // Validate required fields
    if (!location_name) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'location_name is required',
          received: data,
        }),
      };
    }

    // Convert rating from "FIVE" format to number
    let numericRating = null;
    if (rating) {
      const ratingMap = { 'ONE': 1, 'TWO': 2, 'THREE': 3, 'FOUR': 4, 'FIVE': 5 };
      numericRating = ratingMap[String(rating).toUpperCase()] || parseInt(rating) || null;
    }

    // Parse review date
    let parsedDate = new Date().toISOString().split('T')[0];
    if (review_date) {
      try {
        const d = new Date(review_date);
        if (!isNaN(d.getTime())) {
          parsedDate = d.toISOString().split('T')[0];
        }
      } catch (e) {
        console.log('Date parse error:', e);
      }
    }

    // Check for duplicate using fetch
    if (review_id) {
      const checkUrl = `${SUPABASE_URL}/rest/v1/incoming_reviews?google_review_id=eq.${encodeURIComponent(review_id)}&select=id,rating,review_text`;
      const checkRes = await fetch(checkUrl, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
      });
      const existing = await checkRes.json();
      
      if (existing && existing.length > 0) {
        // Reviews are editable on Google: when the stars or text changed,
        // update the stored copy (claims/assignments untouched) instead of
        // skipping - a 4->5 edit must reach the Playbook (Joe 7/24).
        const changed = (numericRating != null && existing[0].rating !== numericRating) ||
          (review_text && review_text !== existing[0].review_text);
        if (changed) {
          await fetch(`${SUPABASE_URL}/rest/v1/incoming_reviews?id=eq.${existing[0].id}`, {
            method: 'PATCH',
            headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
            body: JSON.stringify({ rating: numericRating, review_text: review_text || existing[0].review_text, updated_at: new Date().toISOString() }),
          });
          return { statusCode: 200, headers, body: JSON.stringify({ message: 'Review updated (edited on Google)', id: existing[0].id }) };
        }
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ message: 'Review already exists', id: existing[0].id }),
        };
      }
    }

    // Insert the review using fetch
    const insertUrl = `${SUPABASE_URL}/rest/v1/incoming_reviews`;
    const insertData = {
      location_name: location_name,
      reviewer_name: reviewer_name || 'Anonymous',
      rating: numericRating,
      review_text: review_text || '',
      review_date: parsedDate,
      google_review_id: review_id || null,
      profile_photo_url: profile_photo_url || null,
      status: 'pending',
    };

    console.log('Inserting:', JSON.stringify(insertData));

    const insertRes = await fetch(insertUrl, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(insertData),
    });

    const insertResult = await insertRes.json();
    console.log('Insert response status:', insertRes.status);
    console.log('Insert result:', JSON.stringify(insertResult));

    if (!insertRes.ok) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Failed to save review', 
          details: insertResult,
          hint: 'Make sure incoming_reviews table exists',
        }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        message: 'Review received',
        id: insertResult[0]?.id,
        location: location_name,
        reviewer: reviewer_name,
        rating: numericRating,
      }),
    };

  } catch (error) {
    console.error('Webhook error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message,
      }),
    };
  }
};
