// Scheduled Sales Sync - Runs automatically via Netlify scheduled functions
// This syncs the current month's sales from Google Sheets to Supabase
// Schedule: Every 10 minutes during business hours

const { GoogleAuth } = require('google-auth-library');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SHEET_ID = '1Z_e9cIUZWPKsV0zIMCQvOu2mjIu19YyCsv3ZOBmJ48Y';
const RANGE = 'Data Export!A:O';

// Netlify scheduled function config
exports.config = {
  schedule: "*/10 * * * *" // Every 10 minutes
};

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  // Get current month in CST
  const now = new Date();
  const cstOffset = -6 * 60; // CST is UTC-6
  const cstTime = new Date(now.getTime() + (cstOffset - now.getTimezoneOffset()) * 60000);
  const targetMonth = `${cstTime.getFullYear()}-${String(cstTime.getMonth() + 1).padStart(2, '0')}`;

  console.log('Scheduled Sales Sync: Starting for', targetMonth);

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
      console.log('Skipping: Google API credentials not configured');
      return { statusCode: 200, headers, body: JSON.stringify({ skipped: 'No credentials' }) };
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
    
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken.token}` },
    });

    if (!response.ok) {
      throw new Error(`Sheets API error ${response.status}`);
    }

    const data = await response.json();
    const rows = data.values || [];

    if (rows.length < 2) {
      return { statusCode: 200, headers, body: JSON.stringify({ error: 'No data' }) };
    }

    // Parse rows for current month
    const sheetData = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 4) continue;

      const consultant = (row[2] || '').trim();
      const datePaid = parseDate(row[1]);
      const feePaid = parseFloat((row[3] || '').toString().replace(/[$,]/g, '')) || 0;

      if (!consultant || !datePaid || !feePaid) continue;
      if (!datePaid.startsWith(targetMonth)) continue; // Only current month

      sheetData.push({
        client_name: (row[0] || '').trim() || null,
        date_paid: datePaid,
        consultant: normalizeConsultant(consultant),
        fee_paid: feePaid,
        payment_method: (row[4] || '').trim() || null,
        fee_type: (row[5] || '').trim() || null,
        client_id: (row[6] || '').trim() || null,
        deal_id: (row[7] || '').trim() || null,
        code: (row[8] || '').trim() || null,
        deal_title: (row[9] || '').trim() || null,
        total_price: parseFloat((row[10] || '').toString().replace(/[$,]/g, '')) || null,
        negative_items: parseInt(row[11]) || null,
        same_day_doc_date: parseDate(row[12]) || null,
        refund: (row[13] || '').trim() || null,
        bonus_commission: parseFloat((row[14] || '').toString().replace(/[$,]/g, '')) || 0
      });
    }

    const sheetTotal = sheetData.reduce((sum, r) => sum + r.fee_paid, 0);
    console.log('Sheet data:', sheetData.length, 'rows, $', sheetTotal);

    // Get current Supabase data
    const startDate = `${targetMonth}-01`;
    const endDate = `${targetMonth}-31`;
    
    const { data: dbData, error: dbError } = await supabase
      .from('sales')
      .select('fee_paid')
      .gte('date_paid', startDate)
      .lte('date_paid', endDate);

    if (dbError) throw dbError;

    const dbTotal = dbData.reduce((sum, r) => sum + parseFloat(r.fee_paid || 0), 0);
    const dbCount = dbData.length;

    // Only sync if there's a difference
    if (sheetData.length === dbCount && Math.abs(sheetTotal - dbTotal) < 1) {
      console.log('No changes detected, skipping sync');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          synced: false,
          reason: 'No changes',
          sheet: { count: sheetData.length, total: sheetTotal },
          db: { count: dbCount, total: dbTotal }
        })
      };
    }

    console.log('Changes detected! Sheet:', sheetData.length, '($', sheetTotal, ') vs DB:', dbCount, '($', dbTotal, ')');

    // Delete and re-insert
    const { error: deleteError } = await supabase
      .from('sales')
      .delete()
      .gte('date_paid', startDate)
      .lte('date_paid', endDate);

    if (deleteError) throw deleteError;

    let inserted = 0;
    if (sheetData.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < sheetData.length; i += batchSize) {
        const batch = sheetData.slice(i, i + batchSize);
        const { error: insertError } = await supabase.from('sales').insert(batch);
        if (insertError) throw insertError;
        inserted += batch.length;
      }
    }

    console.log('Sync complete: Deleted', dbCount, ', Inserted', inserted);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        synced: true,
        month: targetMonth,
        deleted: dbCount,
        inserted,
        sheet_total: Math.round(sheetTotal * 100) / 100,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('Scheduled sync error:', error);
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
  
  const parts = str.split('/');
  if (parts.length === 3) {
    const [month, day, year] = parts;
    const fullYear = year.length === 2 ? `20${year}` : year;
    return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  if (str.match(/^\d{4}-\d{2}-\d{2}/)) {
    return str.substring(0, 10);
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
