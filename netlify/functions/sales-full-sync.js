// Sales Full Sync - One-time sync to catch ALL missing payments
// Reads entire Google Sheet and inserts any missing rows into Supabase
// URL: /.netlify/functions/sales-full-sync

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Google Sheet published CSV URL - Data Export tab
const SHEET_ID = '1Z_e9cIUZWPKsV0zIMCQvOu2mjIu19YyCsv3ZOBmJ48Y';
const SHEET_GID = '24680817'; // Data Export tab
// Try the gviz format which often works better for published sheets
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${SHEET_GID}`;

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  console.log('Sales Full Sync: Starting complete sync...');
  console.log('Fetching from URL:', CSV_URL);
  const startTime = Date.now();

  try {
    // Fetch CSV from Google Sheets
    console.log('Fetching from Google Sheet...');
    const response = await fetch(CSV_URL);
    console.log('Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('Error response:', errorText.substring(0, 500));
      throw new Error(`Google Sheets returned ${response.status}: ${errorText.substring(0, 200)}`);
    }

    const csvText = await response.text();
    console.log('CSV length:', csvText.length);
    console.log('First 500 chars:', csvText.substring(0, 500));
    
    const sheetRows = parseCSV(csvText);
    
    console.log(`Sales Full Sync: Parsed ${sheetRows.length} rows from sheet`);

    // Get ALL existing sales from Supabase
    console.log('Fetching existing sales from Supabase...');
    const { data: existingSales, error: fetchError } = await supabase
      .from('sales')
      .select('consultant, date_paid, fee_paid, client_name');

    if (fetchError) {
      throw new Error(`Supabase fetch error: ${fetchError.message}`);
    }

    console.log(`Sales Full Sync: Found ${existingSales.length} existing rows in Supabase`);

    // Create a Set of existing payment keys for fast lookup
    const existingKeys = new Set();
    for (const sale of existingSales) {
      const key = createKey(sale.consultant, sale.date_paid, sale.fee_paid, sale.client_name);
      existingKeys.add(key);
    }

    // Find missing rows
    const missingRows = [];
    for (const row of sheetRows) {
      const key = createKey(row.consultant, row.date_paid, row.fee_paid, row.client_name);
      if (!existingKeys.has(key)) {
        missingRows.push(row);
      }
    }

    console.log(`Sales Full Sync: Found ${missingRows.length} missing rows to insert`);

    if (missingRows.length === 0) {
      const elapsed = Date.now() - startTime;
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          message: 'All data already synced!',
          sheetRows: sheetRows.length,
          existingRows: existingSales.length,
          missingRows: 0,
          inserted: 0,
          elapsed: `${elapsed}ms`
        })
      };
    }

    // Insert missing rows in batches of 100
    let inserted = 0;
    let errors = 0;
    const batchSize = 100;

    for (let i = 0; i < missingRows.length; i += batchSize) {
      const batch = missingRows.slice(i, i + batchSize);
      
      const { error: insertError } = await supabase
        .from('sales')
        .insert(batch);

      if (insertError) {
        console.error(`Batch insert error: ${insertError.message}`);
        errors += batch.length;
      } else {
        inserted += batch.length;
        console.log(`Inserted batch ${Math.floor(i/batchSize) + 1}: ${batch.length} rows`);
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(`Sales Full Sync: Complete. Inserted ${inserted}, Errors ${errors}, Time ${elapsed}ms`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        sheetRows: sheetRows.length,
        existingRows: existingSales.length,
        missingRows: missingRows.length,
        inserted,
        errors,
        elapsed: `${elapsed}ms`
      })
    };

  } catch (error) {
    console.error('Sales Full Sync Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};

function createKey(consultant, datePaid, feePaid, clientName) {
  // Normalize values for comparison
  const c = (consultant || '').toLowerCase().trim();
  const d = datePaid || '';
  const f = parseFloat(feePaid) || 0;
  const n = (clientName || '').toLowerCase().trim();
  return `${c}|${d}|${f}|${n}`;
}

function parseCSV(csvText) {
  const lines = csvText.split('\n');
  if (lines.length < 2) return [];

  const rows = [];
  
  // Skip header row, parse data rows
  // Columns: A=Client Name, B=Date Paid, C=Consultant, D=Fee Paid, E=Payment Method, F=Fee Type, 
  //          G=Client ID, H=Deal ID, I=Code, J=Deal Title, K=Total Price, L=# Negative Items,
  //          M=Doc Paid Date, N=Refund, O=Bonus Commission
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (!values || values.length < 6) continue;
    
    const consultant = cleanValue(values[2]); // Column C
    const datePaid = parseDate(cleanValue(values[1])); // Column B
    const feePaid = parseFloat(cleanValue(values[3])) || 0; // Column D
    
    // Skip rows without required fields
    if (!consultant || !datePaid || !feePaid) continue;

    rows.push({
      client_name: cleanValue(values[0]) || null, // Column A
      date_paid: datePaid,
      consultant: normalizeConsultant(consultant),
      fee_paid: feePaid,
      payment_method: cleanValue(values[4]) || null, // Column E
      fee_type: cleanValue(values[5]) || null, // Column F
      client_id: cleanValue(values[6]) || null, // Column G
      deal_id: cleanValue(values[7]) || null, // Column H
      code: cleanValue(values[8]) || null, // Column I
      deal_title: cleanValue(values[9]) || null, // Column J
      total_price: parseFloat(cleanValue(values[10])) || null, // Column K
      negative_items: parseInt(cleanValue(values[11])) || null, // Column L
      same_day_doc_date: parseDate(cleanValue(values[12])) || null, // Column M
      refund: cleanValue(values[13]) || null, // Column N
      bonus_commission: parseFloat(cleanValue(values[14])) || 0 // Column O - 7% bonus
    });
  }

  return rows;
}

function parseCSVLine(line) {
  if (!line) return [];
  
  const values = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);
  
  return values;
}

function cleanValue(val) {
  if (!val) return null;
  return val.toString().trim().replace(/^"|"$/g, '');
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  
  // Try MM/DD/YYYY format
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const [month, day, year] = parts;
    const fullYear = year.length === 2 ? `20${year}` : year;
    return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Try ISO format
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }
  
  return null;
}

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
