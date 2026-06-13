// Scheduled function to sync sales every 5 minutes
// This runs mode=full which deletes and reimports to prevent duplicates

const { GoogleAuth } = require('google-auth-library');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SHEET_ID = '1Z_e9cIUZWPKsV0zIMCQvOu2mjIu19YyCsv3ZOBmJ48Y';
const RANGE = 'Data Export!A:O';

function parseDate(dateStr) {
  if (!dateStr) return null;
  const str = dateStr.toString().trim();
  const parts = str.split('/');
  if (parts.length === 3) {
    const [month, day, year] = parts;
    const fullYear = year.length === 2 ? '20' + year : year;
    return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return null;
}

exports.handler = async (event, context) => {
  console.log('Sales Auto-Sync triggered at', new Date().toISOString());
  
  try {
    // Get current month
    const now = new Date();
    const targetMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const startDate = `${targetMonth}-01`;
    // Calculate proper end of month
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const endDate = `${targetMonth}-${String(lastDay).padStart(2, '0')}`;
    
    // Auth with Google Sheets
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    
    if (!serviceAccountEmail || !privateKey) {
      throw new Error('Missing Google credentials');
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

    // Fetch from Google Sheets
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(RANGE)}`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken.token}` },
    });

    if (!response.ok) {
      throw new Error(`Sheets API error ${response.status}`);
    }

    const data = await response.json();
    const rows = data.values || [];
    
    // Parse rows
    const sheetMonthData = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 4) continue;

      const consultant = (row[0] || '').trim();
      const datePaid = parseDate(row[1]);
      const clientName = (row[2] || '').trim();
      const feePaid = parseFloat((row[3] || '').toString().replace(/[$,]/g, '')) || 0;

      if (!consultant || !datePaid || !feePaid) continue;
      if (!datePaid.startsWith(targetMonth)) continue;

      sheetMonthData.push({
        client_name: clientName || null,
        date_paid: datePaid,
        consultant: consultant,
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

    const sheetTotal = sheetMonthData.reduce((sum, r) => sum + r.fee_paid, 0);
    console.log('Sheet has', sheetMonthData.length, 'rows, $', sheetTotal);

    // Delete existing month data
    const { error: deleteError } = await supabase
      .from('sales')
      .delete()
      .gte('date_paid', startDate)
      .lte('date_paid', endDate);

    if (deleteError) {
      throw new Error(`Delete failed: ${deleteError.message}`);
    }

    // Insert all rows
    let inserted = 0;
    const batchSize = 50;
    for (let i = 0; i < sheetMonthData.length; i += batchSize) {
      const batch = sheetMonthData.slice(i, i + batchSize);
      const { error: insertError } = await supabase.from('sales').insert(batch);
      if (!insertError) {
        inserted += batch.length;
      }
    }

    console.log('Auto-sync complete: inserted', inserted, 'rows');

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        month: targetMonth,
        inserted,
        total: Math.round(sheetTotal * 100) / 100
      })
    };

  } catch (error) {
    console.error('Auto-sync error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
