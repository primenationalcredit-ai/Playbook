// Sales Sync using Google Sheets API (more reliable than CSV publish)
// URL: /.netlify/functions/sales-api-sync
// ?mode=diagnostic - Shows comparison (default)
// ?mode=sync - DELETES all sales for the month and re-imports from sheet

const { GoogleAuth } = require('google-auth-library');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SHEET_ID = '1Z_e9cIUZWPKsV0zIMCQvOu2mjIu19YyCsv3ZOBmJ48Y';
const RANGE = 'Data Export!A:O'; // Columns A through O

// Global variable to hold name mappings loaded from DB
let nameMap = {};

async function loadNameMappings() {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('name, pipedrive_name')
      .not('pipedrive_name', 'is', null);
    
    if (error) {
      console.error('Error loading name mappings:', error);
      return;
    }
    
    nameMap = {};
    for (const user of users || []) {
      if (user.pipedrive_name && user.name) {
        // Map pipedrive_name (lowercase) -> app name
        nameMap[user.pipedrive_name.toLowerCase().trim()] = user.name;
      }
    }
    console.log('Loaded', Object.keys(nameMap).length, 'name mappings from database');
  } catch (err) {
    console.error('Failed to load name mappings:', err);
  }
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const params = event.queryStringParameters || {};
  const mode = params.mode || 'diagnostic'; // 'diagnostic' or 'sync'
  const month = params.month || null; // Optional: specific month like '2026-01', defaults to current

  // Load name mappings from database
  await loadNameMappings();

  // Determine which month to sync
  const now = new Date();
  const targetMonth = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  console.log('Sales API Sync: Mode =', mode, ', Month =', targetMonth);

  try {
    // Setup Google Auth
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    let privateKey = process.env.GOOGLE_PRIVATE_KEY;
    const privateKeyB64 = process.env.GOOGLE_PRIVATE_KEY_B64;
    
    if (privateKeyB64) {
      privateKey = Buffer.from(privateKeyB64, 'base64').toString('utf8');
    } else if (privateKey) {
      privateKey = privateKey.split('\\n').join('\n');
    }

    if (!privateKey || !serviceAccountEmail) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Google API credentials not configured' })
      };
    }

    const auth = new GoogleAuth({
      credentials: {
        client_email: serviceAccountEmail,
        private_key: privateKey,
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();

    // Fetch data from Sheets API
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(RANGE)}`;
    
    console.log('Fetching from:', url);
    
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken.token}` },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Sheets API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const rows = data.values || [];
    
    console.log('Got', rows.length, 'rows from sheet');

    if (rows.length < 2) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ error: 'No data rows found', rowCount: rows.length })
      };
    }

    // Parse ALL rows from sheet (skip header)
    const allSheetData = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 4) continue;

      // Column A = Consultant, Column B = Date, Column C = Client Name, Column D = Fee
      const consultant = (row[0] || '').trim(); // Column A - Consultant
      const datePaid = parseDate(row[1]); // Column B - Date Paid
      const clientName = (row[2] || '').trim(); // Column C - Client Name
      const feePaid = parseFloat((row[3] || '').toString().replace(/[$,]/g, '')) || 0; // Column D - Fee

      if (!consultant || !datePaid || !feePaid) continue;

      allSheetData.push({
        client_name: clientName || null,
        date_paid: datePaid,
        consultant: normalizeConsultant(consultant),
        fee_paid: feePaid,
        payment_method: (row[4] || '').trim() || null, // Column E
        fee_type: (row[5] || '').trim() || null, // Column F
        client_id: (row[6] || '').trim() || null, // Column G
        deal_id: (row[7] || '').trim() || null, // Column H
        code: (row[8] || '').trim() || null, // Column I
        deal_title: (row[9] || '').trim() || null, // Column J
        total_price: parseFloat((row[10] || '').toString().replace(/[$,]/g, '')) || null, // Column K
        negative_items: parseInt(row[11]) || null, // Column L
        same_day_doc_date: parseDate(row[12]) || null, // Column M
        refund: (row[13] || '').trim() || null, // Column N
        bonus_commission: parseFloat((row[14] || '').toString().replace(/[$,]/g, '')) || 0 // Column O
      });
    }

    console.log('Parsed', allSheetData.length, 'valid rows total');

    // Filter to target month
    const sheetMonthData = allSheetData.filter(r => r.date_paid && r.date_paid.startsWith(targetMonth));
    const sheetTotal = sheetMonthData.reduce((sum, r) => sum + r.fee_paid, 0);
    const sheetBonus = sheetMonthData.reduce((sum, r) => sum + (r.bonus_commission || 0), 0);

    console.log('Month', targetMonth, ':', sheetMonthData.length, 'rows, $', sheetTotal);

    // Get current Supabase data for comparison
    const startDate = `${targetMonth}-01`;
    // Calculate proper end of month
    const [yearNum, monthNum] = targetMonth.split('-').map(Number);
    const lastDay = new Date(yearNum, monthNum, 0).getDate();
    const endDate = `${targetMonth}-${String(lastDay).padStart(2, '0')}`;
    
    const { data: supabaseData, error: dbError } = await supabase
      .from('sales')
      .select('*')
      .gte('date_paid', startDate)
      .lte('date_paid', endDate);

    if (dbError) throw dbError;

    const supabaseTotal = supabaseData.reduce((sum, r) => sum + parseFloat(r.fee_paid || 0), 0);
    const supabaseBonus = supabaseData.reduce((sum, r) => sum + parseFloat(r.bonus_commission || 0), 0);

    // By consultant comparison
    const byConsultant = {};
    sheetMonthData.forEach(r => {
      const c = r.consultant || 'Unknown';
      if (!byConsultant[c]) byConsultant[c] = { sheet: 0, sheetCount: 0, sheetBonus: 0, db: 0, dbCount: 0, dbBonus: 0 };
      byConsultant[c].sheet += r.fee_paid;
      byConsultant[c].sheetCount++;
      byConsultant[c].sheetBonus += r.bonus_commission || 0;
    });
    supabaseData.forEach(r => {
      const c = r.consultant || 'Unknown';
      if (!byConsultant[c]) byConsultant[c] = { sheet: 0, sheetCount: 0, sheetBonus: 0, db: 0, dbCount: 0, dbBonus: 0 };
      byConsultant[c].db += parseFloat(r.fee_paid || 0);
      byConsultant[c].dbCount++;
      byConsultant[c].dbBonus += parseFloat(r.bonus_commission || 0);
    });

    const comparison = Object.entries(byConsultant).map(([consultant, d]) => ({
      consultant,
      sheet_total: Math.round(d.sheet * 100) / 100,
      sheet_count: d.sheetCount,
      sheet_bonus: Math.round(d.sheetBonus * 100) / 100,
      db_total: Math.round(d.db * 100) / 100,
      db_count: d.dbCount,
      db_bonus: Math.round(d.dbBonus * 100) / 100,
      difference: Math.round((d.sheet - d.db) * 100) / 100
    })).sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));

    // RESET MODE: Delete all data for the month
    if (mode === 'reset') {
      console.log('RESET MODE: Deleting all sales for', targetMonth);
      
      const { error: deleteError } = await supabase
        .from('sales')
        .delete()
        .gte('date_paid', startDate)
        .lte('date_paid', endDate);

      if (deleteError) {
        throw new Error(`Delete failed: ${deleteError.message}`);
      }
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          mode: 'reset',
          month: targetMonth,
          deleted: supabaseData.length,
          message: 'All sales deleted for this month. Now run ?mode=sync to reimport.'
        })
      };
    }

    // FULL MODE: Delete everything and reimport (use when data is corrupted)
    if (mode === 'full') {
      console.log('FULL MODE: Deleting and reimporting for', targetMonth);
      
      // Step 1: Delete all existing data for the month
      const { error: deleteError } = await supabase
        .from('sales')
        .delete()
        .gte('date_paid', startDate)
        .lte('date_paid', endDate);

      if (deleteError) {
        throw new Error(`Delete failed: ${deleteError.message}`);
      }
      
      const deleted = supabaseData.length;
      console.log('Deleted', deleted, 'rows');
      
      // Step 2: Insert all rows from sheet in batches
      let inserted = 0;
      const batchSize = 50;
      for (let i = 0; i < sheetMonthData.length; i += batchSize) {
        const batch = sheetMonthData.slice(i, i + batchSize);
        const { error: insertError } = await supabase.from('sales').insert(batch);
        if (insertError) {
          console.error('Insert error at batch', i, ':', insertError.message);
        } else {
          inserted += batch.length;
        }
      }
      
      console.log('FULL SYNC COMPLETE: Deleted', deleted, ', Inserted', inserted);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          mode: 'full',
          month: targetMonth,
          deleted,
          inserted,
          sheet_total: Math.round(sheetTotal * 100) / 100
        })
      };
    }

    // SYNC MODE: Smart incremental using composite key (fast, no duplicates)
    let inserted = 0;
    let skipped = 0;
    
    if (mode === 'sync') {
      console.log('SYNC MODE: Smart incremental for', targetMonth);
      
      // Create composite key: deal_id + date + fee + fee_type (handles multiple payments per deal)
      const makeKey = (r) => `${r.deal_id || ''}|${r.date_paid || ''}|${r.fee_paid || ''}|${r.fee_type || ''}`;
      
      // Get all existing keys for fast lookup
      const existingKeys = new Set(
        supabaseData.map(r => makeKey(r))
      );
      
      // Filter to only NEW rows based on composite key
      const newRows = sheetMonthData.filter(r => {
        const key = makeKey(r);
        return !existingKeys.has(key);
      });
      
      skipped = sheetMonthData.length - newRows.length;
      console.log('Found', newRows.length, 'new rows,', skipped, 'already exist');
      
      // Insert only new rows in batches
      if (newRows.length > 0) {
        const batchSize = 50;
        for (let i = 0; i < newRows.length; i += batchSize) {
          const batch = newRows.slice(i, i + batchSize);
          const { error: insertError } = await supabase.from('sales').insert(batch);
          if (insertError) {
            console.error('Insert error:', insertError.message);
          } else {
            inserted += batch.length;
          }
        }
      }
      
      console.log('SYNC COMPLETE: Inserted', inserted, 'new rows');
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        mode,
        month: targetMonth,
        sheet: {
          total_rows: allSheetData.length,
          month_rows: sheetMonthData.length,
          month_total: Math.round(sheetTotal * 100) / 100,
          month_bonus: Math.round(sheetBonus * 100) / 100
        },
        supabase_before: {
          month_rows: supabaseData.length,
          month_total: Math.round(supabaseTotal * 100) / 100,
          month_bonus: Math.round(supabaseBonus * 100) / 100
        },
        difference_before_sync: Math.round((sheetTotal - supabaseTotal) * 100) / 100,
        sync_result: mode === 'sync' ? {
          inserted,
          skipped,
          new_total: Math.round(sheetTotal * 100) / 100
        } : 'Run with ?mode=sync to add new rows',
        by_consultant: comparison
      }, null, 2)
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};

function parseDate(dateStr) {
  if (!dateStr) return null;
  const str = dateStr.toString().trim();
  
  // MM/DD/YYYY or M/D/YYYY
  const parts = str.split('/');
  if (parts.length === 3) {
    const [month, day, year] = parts;
    const fullYear = year.length === 2 ? `20${year}` : year;
    return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Already ISO format
  if (str.match(/^\d{4}-\d{2}-\d{2}/)) {
    return str.substring(0, 10);
  }
  
  return null;
}

function normalizeConsultant(name) {
  if (!name) return name;
  
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();
  
  // First check database mappings (pipedrive_name -> app name)
  if (nameMap[lower]) {
    return nameMap[lower];
  }
  
  // Normalize all name variations to the standard short names used in the system
  // This ensures consistent consultant names regardless of how they appear in the source
  const normalizeMap = {
    // Carlos variations -> Carlos Salguera
    'carlos danilo salguera balladares': 'Carlos Salguera',
    'carlos salguera': 'Carlos Salguera',
    'carlos': 'Carlos Salguera',
    
    // Eric variations -> Eric De La Rosa
    'eric de la rosa': 'Eric De La Rosa',
    'eric': 'Eric De La Rosa',
    
    // Cindy variations -> Cindy
    'cindy broadstreet': 'Cindy',
    'cindy': 'Cindy',
    
    // Kimberly variations -> Kimberly Sanchez
    'kimberly sanchez': 'Kimberly Sanchez',
    'kimberly': 'Kimberly Sanchez',
    'kim sanchez': 'Kimberly Sanchez',
    'kim': 'Kimberly Sanchez',
    
    // Bryan variations
    'bryan rios': 'Bryan Rios',
    'bryan': 'Bryan Rios',
    
    // Dex-Ann variations
    'dex-ann tillock': 'Dex-Ann Tillock',
    'dex-ann': 'Dex-Ann Tillock',
    'dexann tillock': 'Dex-Ann Tillock',
    'dexann': 'Dex-Ann Tillock',
    
    // Raquel variations
    'raquel lanzas': 'Raquel Lanzas',
    'raquel': 'Raquel Lanzas',
    
    // Rosalia variations
    'rosalia benitez': 'Rosalia Benitez',
    'rosalia': 'Rosalia Benitez',
    
    // Zairen variations
    'zairen verzales': 'Zairen Verzales',
    'zairen': 'Zairen Verzales',
  };
  
  return normalizeMap[lower] || trimmed;
}
