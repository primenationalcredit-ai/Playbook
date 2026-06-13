// CS Deals CSV Import
// Imports CS deals directly from uploaded CSV data
// Much faster than API calls - no rate limiting issues

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Pipeline name to ID mapping
const PIPELINE_MAP = {
  'C.R.S.': 45,
  'SOLD': 7,
  'Quoted 2.0': 42,
  'Quoted': 42,
  'Reports': 37,
  'NEW LEADS': 21,
  'Missed Opportunities': 63
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

  // Accept POST with CSV data in body
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'POST CSV data to this endpoint',
        format: 'Send raw CSV text in request body'
      })
    };
  }

  console.log('CS Deals CSV Import: Starting...');
  const startTime = Date.now();

  try {
    const csvText = event.body;
    
    if (!csvText) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No CSV data provided' })
      };
    }

    // Parse CSV
    const lines = csvText.split('\n');
    const headerLine = lines[0];
    const headers_csv = parseCSVLine(headerLine);
    
    console.log(`CS Deals CSV Import: Found ${lines.length - 1} data rows`);
    console.log(`CS Deals CSV Import: Headers: ${headers_csv.slice(0, 5).join(', ')}...`);

    // Find column indices
    const colIndex = {
      title: headers_csv.findIndex(h => h.includes('Deal - Title')),
      pipeline: headers_csv.findIndex(h => h.includes('Deal - Pipeline')),
      stage: headers_csv.findIndex(h => h.includes('Deal - Stage')),
      dealId: headers_csv.findIndex(h => h.includes('Deal - ID')),
      created: headers_csv.findIndex(h => h.includes('Deal - Deal created')),
      value: headers_csv.findIndex(h => h.includes('Deal - Value')),
      doc1: headers_csv.findIndex(h => h.includes('Deal - Doc (1)')),
      callCenterRep: headers_csv.findIndex(h => h.includes('Call Center Rep')),
      contactPerson: headers_csv.findIndex(h => h.includes('Deal - Contact person'))
    };

    console.log(`CS Deals CSV Import: Column indices:`, JSON.stringify(colIndex));

    // Parse data rows
    const deals = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cols = parseCSVLine(line);
      
      const pipelineName = cols[colIndex.pipeline] || '';
      const pipelineId = PIPELINE_MAP[pipelineName] || null;
      const repName = cols[colIndex.callCenterRep]?.trim() || null;
      const dealId = parseInt(cols[colIndex.dealId]) || null;

      if (!dealId) continue;

      deals.push({
        deal_id: dealId,
        deal_title: cols[colIndex.title] || null,
        pipeline_id: pipelineId,
        pipeline_name: pipelineName || null,
        stage_name: cols[colIndex.stage] || null,
        deal_value: parseFloat(cols[colIndex.value]) || 0,
        call_center_rep_name: repName,
        deal_created_at: parseDate(cols[colIndex.created]),
        synced_at: new Date().toISOString()
      });
    }

    console.log(`CS Deals CSV Import: Parsed ${deals.length} deals`);

    // Count by rep for logging
    const repCounts = {};
    deals.forEach(d => {
      if (d.call_center_rep_name) {
        repCounts[d.call_center_rep_name] = (repCounts[d.call_center_rep_name] || 0) + 1;
      }
    });
    console.log(`CS Deals CSV Import: Deals by rep:`, JSON.stringify(repCounts));

    // Insert into Supabase
    if (SUPABASE_URL && SUPABASE_KEY && deals.length > 0) {
      // Clear existing data
      await fetch(
        `${SUPABASE_URL}/rest/v1/cs_deals?deal_id=gt.0`,
        {
          method: 'DELETE',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
          }
        }
      );
      console.log('CS Deals CSV Import: Cleared existing data');

      // Insert in batches
      const batchSize = 50;
      for (let i = 0; i < deals.length; i += batchSize) {
        const batch = deals.slice(i, i + batchSize);
        
        const response = await fetch(
          `${SUPABASE_URL}/rest/v1/cs_deals`,
          {
            method: 'POST',
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify(batch)
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`CS Deals CSV Import: Insert error: ${errorText}`);
        }
      }
      console.log(`CS Deals CSV Import: Inserted ${deals.length} deals`);

      // Recalculate metrics
      const rpcResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/rpc/recalculate_cs_metrics`,
        {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: '{}'
        }
      );

      if (rpcResponse.ok) {
        console.log('CS Deals CSV Import: Metrics recalculated');
      }

      // Fetch and return the calculated metrics
      const metricsResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/cs_metrics_cache?select=*`,
        {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
          }
        }
      );
      const metrics = await metricsResponse.json();

      const elapsed = Date.now() - startTime;
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          dealsImported: deals.length,
          dealsByRep: repCounts,
          metrics: metrics,
          elapsed: `${elapsed}ms`
        })
      };
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Supabase not configured' })
    };

  } catch (error) {
    console.error('CS Deals CSV Import Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};

// Parse a CSV line handling quoted values
function parseCSVLine(line) {
  const result = [];
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
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  
  return result;
}

// Parse date string to ISO format
function parseDate(dateStr) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
}
