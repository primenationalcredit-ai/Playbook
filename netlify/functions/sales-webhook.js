// Sales Webhook - Receives payment data from Google Sheets and syncs to Supabase
// Sheet ID: 1Z_e9cIUZWPKsV0zIMCQvOu2mjIu19YyCsv3ZOBmJ48Y
// GID: 1527489711 (Total Paid sheet)

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }) 
    };
  }

  try {
    const payload = JSON.parse(event.body);
    console.log('Received payload:', JSON.stringify(payload, null, 2));

    // Handle different payload types
    if (payload.action === 'sync_all') {
      // Full sync - array of all rows
      return await handleFullSync(payload.rows, headers);
    } else if (payload.action === 'add' || payload.action === 'edit') {
      // Single row add/edit
      return await handleSingleRow(payload.row, headers);
    } else if (payload.action === 'delete') {
      // Delete row
      return await handleDelete(payload.row, headers);
    } else if (payload.rows) {
      // Batch of rows (default)
      return await handleFullSync(payload.rows, headers);
    } else if (payload.consultant && payload.date_paid) {
      // Single row without action
      return await handleSingleRow(payload, headers);
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid payload format' })
    };

  } catch (error) {
    console.error('Webhook error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};

async function handleFullSync(rows, headers) {
  if (!rows || !Array.isArray(rows)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'rows must be an array' })
    };
  }

  console.log(`Full sync: Processing ${rows.length} rows`);

  // Map and validate rows
  const salesRecords = rows
    .filter(row => row.consultant && row.date_paid && row.fee_paid)
    .map(row => ({
      consultant: normalizeConsultant(row.consultant),
      date_paid: parseDate(row.date_paid),
      client_name: row.client_name || row.client || null,
      fee_paid: parseFloat(row.fee_paid) || 0,
      fee_type: row.fee_type || row.type || null,
      payment_method: row.payment_method || null,
      same_day_doc_date: parseDate(row.same_day_doc_date) || null,
      notes: row.notes || null
    }));

  if (salesRecords.length === 0) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: 'No valid records to sync', processed: 0 })
    };
  }

  // Get date range from records to clear old data
  const dates = salesRecords.map(r => r.date_paid).filter(d => d);
  const minDate = dates.reduce((a, b) => a < b ? a : b);
  const maxDate = dates.reduce((a, b) => a > b ? a : b);

  // Delete existing records in date range, then insert fresh
  const { error: deleteError } = await supabase
    .from('sales')
    .delete()
    .gte('date_paid', minDate)
    .lte('date_paid', maxDate);

  if (deleteError) {
    console.error('Delete error:', deleteError);
  }

  // Insert all records
  const { data, error } = await supabase
    .from('sales')
    .insert(salesRecords);

  if (error) {
    console.error('Insert error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ 
      success: true, 
      processed: salesRecords.length,
      dateRange: { from: minDate, to: maxDate }
    })
  };
}

async function handleSingleRow(row, headers) {
  if (!row.consultant || !row.date_paid || !row.fee_paid) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Missing required fields: consultant, date_paid, fee_paid' })
    };
  }

  const record = {
    consultant: normalizeConsultant(row.consultant),
    date_paid: parseDate(row.date_paid),
    client_name: row.client_name || row.client || null,
    fee_paid: parseFloat(row.fee_paid) || 0,
    fee_type: row.fee_type || row.type || null,
    payment_method: row.payment_method || null,
    same_day_doc_date: parseDate(row.same_day_doc_date) || null,
    notes: row.notes || null
  };

  // If row has a unique identifier (row_id from sheet), use upsert
  if (row.row_id) {
    // Check if exists
    const { data: existing } = await supabase
      .from('sales')
      .select('id')
      .eq('consultant', record.consultant)
      .eq('date_paid', record.date_paid)
      .eq('client_name', record.client_name)
      .eq('fee_paid', record.fee_paid)
      .single();

    if (existing) {
      // Update
      const { error } = await supabase
        .from('sales')
        .update(record)
        .eq('id', existing.id);

      if (error) throw error;
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, action: 'updated', id: existing.id })
      };
    }
  }

  // Insert new
  const { data, error } = await supabase
    .from('sales')
    .insert([record])
    .select();

  if (error) {
    console.error('Insert error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ success: true, action: 'inserted', id: data?.[0]?.id })
  };
}

async function handleDelete(row, headers) {
  if (!row.consultant || !row.date_paid || !row.fee_paid) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Missing required fields for delete' })
    };
  }

  const { error } = await supabase
    .from('sales')
    .delete()
    .eq('consultant', normalizeConsultant(row.consultant))
    .eq('date_paid', parseDate(row.date_paid))
    .eq('fee_paid', parseFloat(row.fee_paid));

  if (error) {
    console.error('Delete error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ success: true, action: 'deleted' })
  };
}

// Helper: Normalize consultant names to match display names
function normalizeConsultant(name) {
  if (!name) return name;
  
  const normalizeMap = {
    'carlos danilo salguera balladares': 'Carlos Salguera',
    'carlos salguera': 'Carlos Salguera',
    'carlos': 'Carlos Salguera',
    'eric de la rosa': 'Eric De La Rosa',
    'eric': 'Eric De La Rosa',
    'cindy broadstreet': 'Cindy',
    'cindy': 'Cindy',
    'kimberly sanchez': 'Kimberly Sanchez',
    'kimberly': 'Kimberly Sanchez',
    'kim sanchez': 'Kimberly Sanchez',
    'bryan rios': 'Bryan Rios',
    'bryan': 'Bryan Rios',
    'dex-ann tillock': 'Dex-Ann Tillock',
    'dex-ann': 'Dex-Ann Tillock',
    'raquel lanzas': 'Raquel Lanzas',
    'raquel': 'Raquel Lanzas',
    'rosalia benitez': 'Rosalia Benitez',
    'rosalia': 'Rosalia Benitez',
    'zairen verzales': 'Zairen Verzales',
    'zairen': 'Zairen Verzales',
  };
  
  const lower = name.toLowerCase().trim();
  return normalizeMap[lower] || name.trim();
}

// Helper: Parse date from various formats
function parseDate(dateStr) {
  if (!dateStr) return null;
  
  // If already a Date object
  if (dateStr instanceof Date) {
    return dateStr.toISOString().split('T')[0];
  }
  
  // Try parsing as ISO string
  const isoDate = new Date(dateStr);
  if (!isNaN(isoDate.getTime())) {
    return isoDate.toISOString().split('T')[0];
  }
  
  // Try MM/DD/YYYY format
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const [month, day, year] = parts;
    const fullYear = year.length === 2 ? `20${year}` : year;
    return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  return dateStr;
}
