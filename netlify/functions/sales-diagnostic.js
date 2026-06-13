// Sales Diagnostic - Compare Google Sheet vs Supabase to find missing payments
// URL: /.netlify/functions/sales-diagnostic

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

  const params = event.queryStringParameters || {};
  const month = params.month || new Date().toISOString().slice(0, 7); // Default to current month (YYYY-MM)

  console.log('Sales Diagnostic: Analyzing month', month);

  try {
    // 1. Fetch ALL data from Google Sheet
    console.log('Fetching from Google Sheet...');
    const response = await fetch(CSV_URL);
    
    if (!response.ok) {
      throw new Error(`Google Sheets returned ${response.status}`);
    }

    const csvText = await response.text();
    const sheetRows = parseCSV(csvText);
    
    // Filter to selected month
    const sheetMonthRows = sheetRows.filter(row => row.date_paid && row.date_paid.startsWith(month));
    
    console.log(`Sheet: ${sheetRows.length} total rows, ${sheetMonthRows.length} for ${month}`);

    // 2. Fetch ALL data from Supabase for the month
    const startDate = `${month}-01`;
    const endDate = `${month}-31`;
    
    const { data: supabaseRows, error } = await supabase
      .from('sales')
      .select('*')
      .gte('date_paid', startDate)
      .lte('date_paid', endDate);

    if (error) throw error;
    
    console.log(`Supabase: ${supabaseRows.length} rows for ${month}`);

    // 3. Calculate totals
    const sheetTotal = sheetMonthRows.reduce((sum, r) => sum + (r.fee_paid || 0), 0);
    const supabaseTotal = supabaseRows.reduce((sum, r) => sum + parseFloat(r.fee_paid || 0), 0);
    const difference = sheetTotal - supabaseTotal;

    // 4. Find missing rows (in sheet but not in Supabase)
    const supabaseKeys = new Set();
    supabaseRows.forEach(row => {
      const key = createKey(row.consultant, row.date_paid, row.fee_paid, row.client_name);
      supabaseKeys.add(key);
    });

    const missingRows = [];
    sheetMonthRows.forEach(row => {
      const key = createKey(row.consultant, row.date_paid, row.fee_paid, row.client_name);
      if (!supabaseKeys.has(key)) {
        missingRows.push({
          date: row.date_paid,
          consultant: row.consultant,
          client: row.client_name,
          amount: row.fee_paid,
          type: row.fee_type,
          bonus: row.bonus_commission || 0
        });
      }
    });

    // 5. Group by consultant for comparison
    const sheetByConsultant = {};
    const supabaseByConsultant = {};

    sheetMonthRows.forEach(row => {
      const c = row.consultant || 'Unknown';
      if (!sheetByConsultant[c]) sheetByConsultant[c] = { count: 0, total: 0, bonus: 0 };
      sheetByConsultant[c].count++;
      sheetByConsultant[c].total += row.fee_paid || 0;
      sheetByConsultant[c].bonus += row.bonus_commission || 0;
    });

    supabaseRows.forEach(row => {
      const c = row.consultant || 'Unknown';
      if (!supabaseByConsultant[c]) supabaseByConsultant[c] = { count: 0, total: 0, bonus: 0 };
      supabaseByConsultant[c].count++;
      supabaseByConsultant[c].total += parseFloat(row.fee_paid) || 0;
      supabaseByConsultant[c].bonus += parseFloat(row.bonus_commission) || 0;
    });

    // 6. Build comparison
    const consultants = [...new Set([...Object.keys(sheetByConsultant), ...Object.keys(supabaseByConsultant)])];
    const comparison = consultants.map(c => {
      const sheet = sheetByConsultant[c] || { count: 0, total: 0, bonus: 0 };
      const db = supabaseByConsultant[c] || { count: 0, total: 0, bonus: 0 };
      return {
        consultant: c,
        sheet_count: sheet.count,
        sheet_total: Math.round(sheet.total * 100) / 100,
        sheet_bonus: Math.round(sheet.bonus * 100) / 100,
        db_count: db.count,
        db_total: Math.round(db.total * 100) / 100,
        db_bonus: Math.round(db.bonus * 100) / 100,
        missing_count: sheet.count - db.count,
        missing_amount: Math.round((sheet.total - db.total) * 100) / 100
      };
    }).sort((a, b) => b.missing_amount - a.missing_amount);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        month,
        summary: {
          sheet_rows: sheetMonthRows.length,
          supabase_rows: supabaseRows.length,
          missing_rows: missingRows.length,
          sheet_total: Math.round(sheetTotal * 100) / 100,
          supabase_total: Math.round(supabaseTotal * 100) / 100,
          difference: Math.round(difference * 100) / 100
        },
        by_consultant: comparison,
        missing_payments: missingRows.slice(0, 50), // First 50 missing
        total_missing_value: Math.round(missingRows.reduce((sum, r) => sum + r.amount, 0) * 100) / 100
      }, null, 2)
    };

  } catch (error) {
    console.error('Diagnostic Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};

function createKey(consultant, datePaid, feePaid, clientName) {
  const c = (consultant || '').toLowerCase().trim();
  const d = datePaid || '';
  const f = parseFloat(feePaid) || 0;
  const n = (clientName || '').toLowerCase().trim().substring(0, 20);
  return `${c}|${d}|${f}|${n}`;
}

function parseCSV(csvText) {
  const lines = csvText.split('\n');
  if (lines.length < 2) return [];

  const rows = [];
  
  // Columns: A=Client Name, B=Date Paid, C=Consultant, D=Fee Paid, E=Payment Method, F=Fee Type, 
  //          G=Client ID, H=Deal ID, I=Code, J=Deal Title, K=Total Price, L=# Negative Items,
  //          M=Doc Paid Date, N=Refund, O=Bonus Commission
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (!values || values.length < 6) continue;
    
    const consultant = cleanValue(values[2]);
    const datePaid = parseDate(cleanValue(values[1]));
    const feePaid = parseFloat(cleanValue(values[3])) || 0;
    
    if (!consultant || !datePaid || !feePaid) continue;

    rows.push({
      client_name: cleanValue(values[0]) || null,
      date_paid: datePaid,
      consultant: normalizeConsultant(consultant),
      fee_paid: feePaid,
      payment_method: cleanValue(values[4]) || null,
      fee_type: cleanValue(values[5]) || null,
      bonus_commission: parseFloat(cleanValue(values[14])) || 0
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
  
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const [month, day, year] = parts;
    const fullYear = year.length === 2 ? `20${year}` : year;
    return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
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
