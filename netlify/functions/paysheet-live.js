// PAYSHEET-LIVE: Reads payment data directly from Google Sheets
// NO Supabase sync - eliminates duplicate/stale data issues
// Accepts multiple months in one call for speed (current + last month)

const { GoogleAuth } = require('google-auth-library');

const SHEET_ID = '1Z_e9cIUZWPKsV0zIMCQvOu2mjIu19YyCsv3ZOBmJ48Y';
const RANGE = 'Data Export!A:Q'; // Columns A through Q

let nameMap = {};

async function loadNameMappings() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/users?select=name,pipedrive_name&pipedrive_name=not.is.null`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const users = await res.json();
    nameMap = {};
    for (const user of (users || [])) {
      if (user.pipedrive_name && user.name) {
        nameMap[user.pipedrive_name.toLowerCase().trim()] = user.name;
      }
    }
  } catch (err) { console.error('Name mapping error:', err.message); }
}

function normalizeConsultant(name) {
  if (!name) return name;
  const lower = name.trim().toLowerCase();
  if (nameMap[lower]) return nameMap[lower];
  const map = {
    'carlos danilo salguera balladares': 'Carlos Salguera',
    'carlos salguera': 'Carlos Salguera', 'carlos': 'Carlos Salguera',
    'eric de la rosa': 'Eric De La Rosa', 'eric': 'Eric De La Rosa',
    'cindy broadstreet': 'Cindy', 'cindy': 'Cindy',
    'kimberly sanchez': 'Kimberly Sanchez', 'kimberly': 'Kimberly Sanchez',
    'kim sanchez': 'Kimberly Sanchez', 'kim': 'Kimberly Sanchez',
    'bryan rios': 'Bryan Rios', 'bryan': 'Bryan Rios',
    'dex-ann tillock': 'Dex-Ann Tillock', 'dex-ann': 'Dex-Ann Tillock',
    'dexann tillock': 'Dex-Ann Tillock', 'dexann': 'Dex-Ann Tillock',
    'raquel lanzas': 'Raquel Lanzas', 'raquel': 'Raquel Lanzas',
    'zairen verzales': 'Zairen Verzales', 'zairen': 'Zairen Verzales',
    'rosa alvarez': 'Rosa Alvarez', 'rosa': 'Rosa Alvarez',
    'erika martinez': 'Erika Martinez', 'erika': 'Erika Martinez',
    'jenifer venegas': 'Jenifer Venegas', 'jenifer': 'Jenifer Venegas',
  };
  if (map[lower]) return map[lower];
  return name.trim();
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  const str = dateStr.toString().trim();
  const parts = str.split('/');
  if (parts.length === 3) {
    let [m, d, y] = parts.map(Number);
    if (y < 100) y += 2000;
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.substring(0, 10);
  return null;
}

function parseRow(row, affiliateColIdx) {
  const consultant = (row[0] || '').trim();
  const datePaid = parseDate(row[1]);
  const clientName = (row[2] || '').trim();
  const feePaid = parseFloat((row[3] || '').toString().replace(/[$,]/g, '')) || 0;
  if (!consultant || !datePaid || !feePaid) return null;

  const affiliateVal = affiliateColIdx >= 0 ? (parseFloat((row[affiliateColIdx] || '').toString().replace(/[$,]/g, '')) || 0) : 0;

  return {
    consultant: normalizeConsultant(consultant),
    date_paid: datePaid,
    client_name: clientName || null,
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
    bonus_commission: parseFloat((row[14] || '').toString().replace(/[$,]/g, '')) || 0,
    affiliate_deduct: affiliateVal
  };
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const params = event.queryStringParameters || {};
  // Accept single month or comma-separated months: ?months=2026-02,2026-01
  const monthsParam = params.months || params.month;
  if (!monthsParam) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Required: ?months=YYYY-MM or ?months=YYYY-MM,YYYY-MM' }) };
  }
  const months = monthsParam.split(',').map(m => m.trim()).filter(m => /^\d{4}-\d{2}$/.test(m));
  if (months.length === 0) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid month format. Use YYYY-MM' }) };
  }

  try {
    await loadNameMappings();

    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    let privateKey = process.env.GOOGLE_PRIVATE_KEY;
    const privateKeyB64 = process.env.GOOGLE_PRIVATE_KEY_B64;
    if (privateKeyB64) {
      privateKey = Buffer.from(privateKeyB64, 'base64').toString('utf8');
    } else if (privateKey) {
      privateKey = privateKey.split('\\n').join('\n');
    }
    if (!privateKey || !serviceAccountEmail) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Google API credentials not configured' }) };
    }

    const auth = new GoogleAuth({
      credentials: { client_email: serviceAccountEmail, private_key: privateKey },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();

    // Single API call - get ALL data
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(RANGE)}`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken.token}` },
    });
    if (!response.ok) {
      throw new Error(`Sheets API error ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    const rows = data.values || [];
    
    // Detect affiliate column from header
    const headerRow = rows[0] || [];
    let affiliateColIdx = -1;
    for (let h = 0; h < headerRow.length; h++) {
      const hdr = (headerRow[h] || '').toString().toLowerCase().trim();
      if (hdr.includes('affiliate')) {
        affiliateColIdx = h;
        break;
      }
    }
    console.log(`[paysheet-live] ${rows.length} rows, header cols: ${headerRow.length}, affiliate col: ${affiliateColIdx >= 0 ? affiliateColIdx : 'NOT FOUND'}`);

    // Parse ALL rows once, bucket by month
    const byMonth = {};
    months.forEach(m => { byMonth[m] = []; });

    for (let i = 1; i < rows.length; i++) {
      const parsed = parseRow(rows[i], affiliateColIdx);
      if (!parsed) continue;
      const rowMonth = parsed.date_paid.substring(0, 7);
      if (byMonth[rowMonth] !== undefined) {
        byMonth[rowMonth].push(parsed);
      }
    }

    // Build response per month
    const result = {};
    for (const m of months) {
      const salesRows = byMonth[m];
      const byConsultant = {};
      const docStats = {};
      salesRows.forEach(r => {
        const c = r.consultant;
        if (!byConsultant[c]) byConsultant[c] = { total: 0, count: 0 };
        byConsultant[c].total += r.fee_paid;
        byConsultant[c].count++;
        
        // Doc counting diagnostics (same logic as frontend)
        const code = (r.code || '').toLowerCase();
        if (code.includes('doc')) {
          if (!docStats[c]) docStats[c] = { fs: 0, fm: 0, ff: 0, sdFs: 0, sdFm: 0, sdFf: 0, total: 0 };
          const day = parseInt(r.date_paid.split('-')[2]) || 1;
          const period = day <= 10 ? 'fs' : day <= 20 ? 'fm' : 'ff';
          docStats[c][period]++;
          docStats[c].total++;
          if (r.same_day_doc_date) {
            docStats[c]['sd' + period.charAt(0).toUpperCase() + period.slice(1)]++;
          }
        }
      });
      const totalSales = salesRows.reduce((sum, r) => sum + r.fee_paid, 0);
      console.log(`[paysheet-live] ${m}: ${salesRows.length} rows, $${totalSales.toFixed(2)}`);
      Object.entries(docStats).forEach(([c, d]) => {
        console.log(`  ${c} docs: FS=${d.fs} FM=${d.fm} FF=${d.ff} total=${d.total} | SD: FS=${d.sdFs} FM=${d.sdFm} FF=${d.sdFf}`);
      });
      result[m] = {
        rows: salesRows,
        summary: { total_rows: salesRows.length, total_sales: Math.round(totalSales * 100) / 100, by_consultant: byConsultant }
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, source: 'google-sheets-live', months: result })
    };

  } catch (error) {
    console.error('[paysheet-live] Error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};
