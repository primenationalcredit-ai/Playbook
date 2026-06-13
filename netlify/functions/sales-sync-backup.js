// Sales Sync Backup - Runs hourly to catch any missed payments
// Reads from published Google Sheet and syncs to Supabase
// This is a BACKUP - primary sync should be via Zapier webhook

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Google Sheet published CSV URL - Data Export tab
const SHEET_ID = '1Z_e9cIUZWPKsV0zIMCQvOu2mjIu19YyCsv3ZOBmJ48Y';
const SHEET_GID = '24680817'; // Data Export tab
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${SHEET_GID}`;

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  console.log('Sales Sync Backup: Starting...');

  try {
    // Fetch CSV from Google Sheets
    const response = await fetch(CSV_URL);
    if (!response.ok) {
      throw new Error(`Google Sheets returned ${response.status}`);
    }

    const csvText = await response.text();
    const rows = parseCSV(csvText);
    
    console.log(`Sales Sync Backup: Parsed ${rows.length} rows from sheet`);

    // Get last 7 days of data from sheet (most likely to have new/missed payments)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentRows = rows.filter(row => {
      if (!row.date_paid) return false;
      const rowDate = new Date(row.date_paid);
      return rowDate >= sevenDaysAgo;
    });

    console.log(`Sales Sync Backup: ${recentRows.length} rows from last 7 days`);

    if (recentRows.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, message: 'No recent rows to sync', synced: 0 })
      };
    }

    // Upsert each row (insert if not exists, update if exists)
    let synced = 0;
    let errors = 0;

    for (const row of recentRows) {
      try {
        // Check if this exact payment already exists
        const { data: existing } = await supabase
          .from('sales')
          .select('id')
          .eq('consultant', row.consultant)
          .eq('date_paid', row.date_paid)
          .eq('fee_paid', row.fee_paid)
          .eq('client_name', row.client_name)
          .maybeSingle();

        if (!existing) {
          // Insert new payment
          const { error } = await supabase
            .from('sales')
            .insert([row]);

          if (error) {
            console.error('Insert error:', error);
            errors++;
          } else {
            synced++;
            console.log(`Synced: ${row.client_name} - $${row.fee_paid} on ${row.date_paid}`);
          }
        }
      } catch (err) {
        console.error('Row error:', err);
        errors++;
      }
    }

    console.log(`Sales Sync Backup: Complete. Synced ${synced}, Errors ${errors}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        totalRows: rows.length,
        recentRows: recentRows.length,
        synced,
        errors
      })
    };

  } catch (error) {
    console.error('Sales Sync Backup Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};

function parseCSV(csvText) {
  const lines = csvText.split('\n');
  if (lines.length < 2) return [];

  const rows = [];
  
  // Skip header row, parse data rows
  // CORRECT Columns: A=Consultant Name, B=Date Paid, C=Client 1, D=Fee Paid, E=Payment Method, F=Fee Type, etc.
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (!values || values.length < 6) continue;
    
    const consultant = cleanValue(values[0]); // Column A - Consultant Name
    const datePaid = parseDate(cleanValue(values[1])); // Column B - Date Paid
    const clientName = cleanValue(values[2]); // Column C - Client 1
    const feePaid = parseFloat(cleanValue(values[3])) || 0; // Column D - Fee Paid
    
    // Skip rows without required fields
    if (!consultant || !datePaid || !feePaid) continue;

    rows.push({
      consultant: normalizeConsultant(consultant),
      date_paid: datePaid,
      client_name: clientName || null,
      fee_paid: feePaid,
      payment_method: cleanValue(values[4]) || null, // Column E
      fee_type: cleanValue(values[5]) || null, // Column F
      same_day_doc_date: parseDate(cleanValue(values[12])) || null // Column M
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
