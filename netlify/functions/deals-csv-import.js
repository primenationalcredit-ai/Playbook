// Deals CSV Import Function
// Bulk import deals from Pipedrive CSV export to Supabase

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Pipedrive Field IDs (from Bible)
const FIELD_MAPPINGS = {
  'Doc (1)': 'doc_1',
  'Final (1)': 'final_1',
  'RD1 Start/End Dates': 'rd1_start_end_dates',
  'Call Center Rep': 'call_center_rep_name'
};

// Pipeline name to ID mapping
const PIPELINE_IDS = {
  'Quoted 2.0': 42,
  'Quoted': 42,
  'SOLD': 7,
  'Sold': 7,
  'C.R.S.': 45,
  'CRS': 45,
  'NEW LEADS': 21,
  'New Leads': 21,
  'Reports': 37,
  'Missed Opportunities': 63
};

// Stage name to ID mapping (add more as needed)
const STAGE_IDS = {
  'Ready to Quote': 490
  // Add more stages as we discover them
};

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
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

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Supabase not configured' })
    };
  }

  try {
    // Parse request body with error handling
    let requestBody;
    try {
      requestBody = JSON.parse(event.body);
    } catch (parseErr) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Invalid JSON in request body. File may be too large - try exporting fewer deals.',
          details: parseErr.message
        })
      };
    }

    const { csvData, hasHeaders = true } = requestBody;
    
    if (!csvData) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No CSV data provided' })
      };
    }

    // Parse CSV
    const lines = csvData.split('\n').filter(line => line.trim());
    if (lines.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Empty CSV data' })
      };
    }

    // Get headers
    const headerLine = lines[0];
    const columnHeaders = parseCSVLine(headerLine);
    
    // Find column indexes
    const columnIndexes = {
      id: findColumnIndex(columnHeaders, ['ID', 'Deal ID', 'id']),
      title: findColumnIndex(columnHeaders, ['Title', 'Deal', 'title', 'Deal - Title']),
      owner_name: findColumnIndex(columnHeaders, ['Owner', 'Owner name', 'Deal owner', 'Deal - Owner']),
      pipeline: findColumnIndex(columnHeaders, ['Pipeline', 'Deal - Pipeline']),
      stage: findColumnIndex(columnHeaders, ['Stage', 'Deal - Stage']),
      status: findColumnIndex(columnHeaders, ['Status', 'Deal - Status']),
      value: findColumnIndex(columnHeaders, ['Value', 'Deal value', 'Deal - Value']),
      doc_1: findColumnIndex(columnHeaders, ['Doc (1)', 'Doc(1)', 'Deal - Doc (1)']),
      final_1: findColumnIndex(columnHeaders, ['Final (1)', 'Final(1)', 'Deal - Final (1)']),
      rd1_dates: findColumnIndex(columnHeaders, ['RD1 Start/End Dates', 'Deal - RD1 Start/End Dates']),
      call_center_rep: findColumnIndex(columnHeaders, ['Call Center Rep', 'Deal - Call Center Rep']),
      person_name: findColumnIndex(columnHeaders, ['Person', 'Person name', 'Contact person', 'Deal - Contact person']),
      person_email: findColumnIndex(columnHeaders, ['Email', 'Person email', 'Deal - Person - Email']),
      person_phone: findColumnIndex(columnHeaders, ['Phone', 'Person phone', 'Deal - Person - Phone']),
      org_name: findColumnIndex(columnHeaders, ['Organization', 'Org', 'Deal - Organization']),
      add_time: findColumnIndex(columnHeaders, ['Add time', 'Created', 'Deal created', 'Deal - Add time']),
      update_time: findColumnIndex(columnHeaders, ['Update time', 'Updated', 'Deal - Update time']),
      stage_change_time: findColumnIndex(columnHeaders, ['Stage change time', 'Deal - Stage change time']),
      won_time: findColumnIndex(columnHeaders, ['Won time', 'Deal - Won time']),
      lost_time: findColumnIndex(columnHeaders, ['Lost time', 'Deal - Lost time']),
      close_time: findColumnIndex(columnHeaders, ['Close time', 'Deal - Close time'])
    };

    // Process data rows
    const dataLines = hasHeaders ? lines.slice(1) : lines;
    const deals = [];
    const errors = [];
    let processed = 0;
    let skipped = 0;

    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i].trim();
      if (!line) continue;

      try {
        const values = parseCSVLine(line);
        
        const dealId = getColumnValue(values, columnIndexes.id);
        if (!dealId || isNaN(parseInt(dealId))) {
          skipped++;
          continue;
        }

        const pipelineName = getColumnValue(values, columnIndexes.pipeline);
        const stageName = getColumnValue(values, columnIndexes.stage);

        const deal = {
          id: parseInt(dealId),
          title: getColumnValue(values, columnIndexes.title),
          owner_name: getColumnValue(values, columnIndexes.owner_name),
          pipeline_id: PIPELINE_IDS[pipelineName] || null,
          pipeline_name: pipelineName,
          stage_id: STAGE_IDS[stageName] || null,
          stage_name: stageName,
          status: (getColumnValue(values, columnIndexes.status) || 'open').toLowerCase(),
          value: parseFloat(getColumnValue(values, columnIndexes.value)) || 0,
          doc_1: normalizeDoc1Value(getColumnValue(values, columnIndexes.doc_1)),
          final_1: getColumnValue(values, columnIndexes.final_1),
          rd1_start_end_dates: getColumnValue(values, columnIndexes.rd1_dates),
          call_center_rep_name: getColumnValue(values, columnIndexes.call_center_rep),
          person_name: getColumnValue(values, columnIndexes.person_name),
          person_email: getColumnValue(values, columnIndexes.person_email),
          person_phone: getColumnValue(values, columnIndexes.person_phone),
          org_name: getColumnValue(values, columnIndexes.org_name),
          add_time: parseDate(getColumnValue(values, columnIndexes.add_time)),
          update_time: parseDate(getColumnValue(values, columnIndexes.update_time)),
          stage_change_time: parseDate(getColumnValue(values, columnIndexes.stage_change_time)),
          won_time: parseDate(getColumnValue(values, columnIndexes.won_time)),
          lost_time: parseDate(getColumnValue(values, columnIndexes.lost_time)),
          close_time: parseDate(getColumnValue(values, columnIndexes.close_time)),
          last_synced_at: new Date().toISOString()
        };

        deals.push(deal);
        processed++;
      } catch (err) {
        errors.push({ line: i + 2, error: err.message });
      }
    }

    // Batch upsert to Supabase
    const batchSize = 100;
    let inserted = 0;
    let updated = 0;

    for (let i = 0; i < deals.length; i += batchSize) {
      const batch = deals.slice(i, i + batchSize);
      
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/deals`,
        {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
          },
          body: JSON.stringify(batch)
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Supabase error: ${errText}`);
      }

      inserted += batch.length;
    }

    // Also create stage history entries for current stages
    const stageHistoryEntries = deals.map(d => ({
      deal_id: d.id,
      to_stage_id: d.stage_id,
      to_stage_name: d.stage_name,
      pipeline_id: d.pipeline_id,
      pipeline_name: d.pipeline_name,
      changed_at: d.stage_change_time || d.add_time || new Date().toISOString()
    }));

    // Insert stage history (ignore conflicts)
    for (let i = 0; i < stageHistoryEntries.length; i += batchSize) {
      const batch = stageHistoryEntries.slice(i, i + batchSize);
      
      await fetch(
        `${SUPABASE_URL}/rest/v1/deal_stage_history`,
        {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=ignore-duplicates'
          },
          body: JSON.stringify(batch)
        }
      );
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Imported ${inserted} deals`,
        stats: {
          totalLines: dataLines.length,
          processed,
          skipped,
          inserted,
          errors: errors.length
        },
        columnIndexes,
        sampleDeal: deals[0] || null,
        errors: errors.slice(0, 10) // First 10 errors
      })
    };

  } catch (error) {
    console.error('Import error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};

// Parse a CSV line handling quoted values
function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  
  return values;
}

// Find column index by possible names
function findColumnIndex(headers, possibleNames) {
  for (const name of possibleNames) {
    const index = headers.findIndex(h => 
      h.toLowerCase().trim() === name.toLowerCase().trim()
    );
    if (index !== -1) return index;
  }
  return -1;
}

// Get value from array by index
function getColumnValue(values, index) {
  if (index === -1 || index >= values.length) return null;
  const val = values[index]?.trim();
  return val === '' ? null : val;
}

// Parse various date formats
function parseDate(dateStr) {
  if (!dateStr) return null;
  
  // Try ISO format first
  let date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date.toISOString();
  }
  
  // Try MM/DD/YYYY format
  const parts = dateStr.split(/[\/\-]/);
  if (parts.length === 3) {
    date = new Date(parts[2], parts[0] - 1, parts[1]);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  
  return null;
}

// Normalize Doc(1) field value to consistent format
function normalizeDoc1Value(value) {
  if (!value) return null;
  const lower = value.toLowerCase().trim();
  if (lower === 'yes' || lower === '1104' || value === 1104) return '1104';
  if (lower === 'no' || lower === '1105' || value === 1105) return '1105';
  return value;
}
