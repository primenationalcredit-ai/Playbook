// Google Sheets Sync Function
// Fetches credit repair results data from Google Sheets
// Uses GOOGLE_PRIVATE_KEY_B64 (base64 encoded) to avoid newline issues

const { GoogleAuth } = require('google-auth-library');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };
  
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  
  try {
    const sheetId = process.env.GOOGLE_SHEET_ID || '1ABQEwlRRLYTszraGaLSDli1MxRZE4adAemWm9UF9aHw';
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    let privateKey = process.env.GOOGLE_PRIVATE_KEY;
    const privateKeyB64 = process.env.GOOGLE_PRIVATE_KEY_B64;
    
    // If base64 encoded key exists, decode it
    if (privateKeyB64) {
      try {
        privateKey = Buffer.from(privateKeyB64, 'base64').toString('utf8');
        console.log('Decoded base64 key successfully');
      } catch (e) {
        console.error('Failed to decode base64 key:', e.message);
      }
    }
    
    // If we still have the regular key, try to fix its format
    if (privateKey && !privateKeyB64) {
      // Replace literal \n with actual newlines
      privateKey = privateKey.split('\\n').join('\n');
      
      // If still no newlines, reconstruct PEM
      if (!privateKey.includes('\n') && privateKey.includes('-----BEGIN')) {
        const match = privateKey.match(/-----BEGIN PRIVATE KEY-----(.*?)-----END PRIVATE KEY-----/s);
        if (match) {
          const keyContent = match[1].replace(/\s+/g, '');
          const formattedKey = keyContent.match(/.{1,64}/g).join('\n');
          privateKey = `-----BEGIN PRIVATE KEY-----\n${formattedKey}\n-----END PRIVATE KEY-----\n`;
        }
      }
    }
    
    console.log('Sheet ID:', sheetId);
    console.log('Email:', serviceAccountEmail);
    console.log('Key exists:', !!privateKey);
    console.log('Key length:', privateKey?.length);
    
    if (!privateKey || !serviceAccountEmail) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Google API credentials not configured',
          mockData: true,
          metrics: getMockMetrics()
        })
      };
    }
    
    const params = event.queryStringParameters || {};
    const range = params.range || 'Data!A:Z';
    const period = params.period || 'month';
    
    // Create auth client
    const auth = new GoogleAuth({
      credentials: {
        client_email: serviceAccountEmail,
        private_key: privateKey,
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();
    
    console.log('Got access token');
    
    // Fetch from Sheets API
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`;
    
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken.token}` },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API error:', response.status, errorText);
      throw new Error(`Sheets API: ${response.status}`);
    }
    
    const data = await response.json();
    const rows = data.values || [];
    const parsedData = parseCreditResults(rows);
    
    const now = new Date();
    let startDate;
    if (period === 'week') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === 'month') {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else {
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    }
    
    const metrics = calculateMetrics(parsedData, startDate, now);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        sheetId,
        period,
        rowCount: rows.length,
        metrics
      })
    };
    
  } catch (error) {
    console.error('Error:', error.message);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
        mockData: true,
        metrics: getMockMetrics()
      })
    };
  }
};

function parseCreditResults(rows) {
  if (!rows || rows.length < 2) return [];
  
  const data = [];
  
  // Column mapping based on actual sheet structure:
  // A=Date, B=Client Name, C=Starting Rounds, D=CRA Letters Sent, E=Data Furnisher Letters
  // F=Starting Equifax, G=Starting Experian, H=Starting Transunion
  // I=Current EQ, J=Current EX, K=Current TU
  // L=Late Items Repaired/Bureau, M=Accounts Removed/Bureau, N=Total Items Removed, O=Letter Route
  // P=Date, Q=Round
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    
    // Parse the round number from column C or Q
    let roundNum = 0;
    const roundText = (row[2] || row[16] || '').toString();
    const roundMatch = roundText.match(/(\d+)/);
    if (roundMatch) roundNum = parseInt(roundMatch[1]);
    
    // Parse bureau removals from columns L (Late Items Repaired) and M (Accounts Removed)
    const lateItemsText = (row[11] || '').toString();
    const accountsRemovedText = (row[12] || '').toString();
    const combinedText = lateItemsText + ', ' + accountsRemovedText;
    
    // Count removals per bureau by looking for (EQ), (EX), (TR) patterns
    const bureauRemovals = countBureauRemovals(combinedText);
    
    // Calculate score improvements
    const startingEQ = parseInt(row[5]) || 0;
    const startingEX = parseInt(row[6]) || 0;
    const startingTU = parseInt(row[7]) || 0;
    const currentEQ = parseInt(row[8]) || 0;
    const currentEX = parseInt(row[9]) || 0;
    const currentTU = parseInt(row[10]) || 0;
    
    const record = {
      date: row[0] || row[15] || '',
      client_name: row[1] || '',
      round: roundNum,
      items_disputed: 3, // Each letter disputes items at all 3 bureaus
      total_removed: bureauRemovals.total,
      equifax_removed: bureauRemovals.equifax,
      experian_removed: bureauRemovals.experian,
      transunion_removed: bureauRemovals.transunion,
      equifax_start: startingEQ,
      equifax_current: currentEQ,
      experian_start: startingEX,
      experian_current: currentEX,
      transunion_start: startingTU,
      transunion_current: currentTU,
      letter_route: row[14] || ''
    };
    
    data.push(record);
  }
  return data;
}

// Count bureau removals from text like "ACCOUNT NAME(EX, EQ, TR), ANOTHER(TR)"
function countBureauRemovals(text) {
  const results = { equifax: 0, experian: 0, transunion: 0, total: 0 };
  
  if (!text) return results;
  
  // Find all items with bureau tags - split by comma but be careful of commas inside parentheses
  // Pattern: Look for (EQ), (EX), (TR) or combinations like (EX, EQ, TR)
  
  // Find all parenthetical bureau mentions
  const matches = text.match(/\([^)]*(?:EQ|EX|TR)[^)]*\)/gi) || [];
  
  matches.forEach(match => {
    const upperMatch = match.toUpperCase();
    if (upperMatch.includes('EQ')) {
      results.equifax++;
      results.total++;
    }
    if (upperMatch.includes('EX')) {
      results.experian++;
      results.total++;
    }
    if (upperMatch.includes('TR') || upperMatch.includes('TU')) {
      results.transunion++;
      results.total++;
    }
  });
  
  return results;
}

function calculateMetrics(data, startDate, endDate) {
  const filteredData = data.filter(record => {
    if (!record.date) return true;
    const recordDate = new Date(record.date);
    return !isNaN(recordDate) && recordDate >= startDate && recordDate <= endDate;
  });
  
  let totalItemsDisputed = 0;
  let totalItemsRemoved = 0;
  
  // Track unique clients
  const uniqueClients = new Set();
  
  // By bureau breakdown
  const byBureau = {
    equifax: { disputed: 0, removed: 0, favorable: 0 },
    experian: { disputed: 0, removed: 0, favorable: 0 },
    transunion: { disputed: 0, removed: 0, favorable: 0 }
  };
  
  // By round breakdown - add round 5
  const byRound = { 
    1: { clients: 0, disputed: 0, removed: 0 }, 
    2: { clients: 0, disputed: 0, removed: 0 }, 
    3: { clients: 0, disputed: 0, removed: 0 }, 
    4: { clients: 0, disputed: 0, removed: 0 },
    5: { clients: 0, disputed: 0, removed: 0 }
  };
  
  filteredData.forEach(record => {
    if (record.client_name) uniqueClients.add(record.client_name);
    
    totalItemsDisputed += record.items_disputed || 0;
    totalItemsRemoved += record.total_removed || 0;
    
    // Add to bureau totals from parsed data
    byBureau.equifax.disputed += 1;
    byBureau.experian.disputed += 1;
    byBureau.transunion.disputed += 1;
    byBureau.equifax.removed += record.equifax_removed || 0;
    byBureau.experian.removed += record.experian_removed || 0;
    byBureau.transunion.removed += record.transunion_removed || 0;
    byBureau.equifax.favorable += record.equifax_removed || 0;
    byBureau.experian.favorable += record.experian_removed || 0;
    byBureau.transunion.favorable += record.transunion_removed || 0;
    
    // Round stats
    const round = record.round;
    if (round >= 1 && round <= 5 && byRound[round]) {
      byRound[round].clients += 1;
      byRound[round].disputed += record.items_disputed || 0;
      byRound[round].removed += record.total_removed || 0;
    }
  });
  
  const totalFavorable = totalItemsRemoved;
  const favorableRate = totalItemsDisputed > 0 ? Math.round((totalFavorable / totalItemsDisputed) * 100) : 0;
  const deletionRate = totalItemsDisputed > 0 ? Math.round((totalItemsRemoved / totalItemsDisputed) * 100) : 0;
  
  return {
    summary: { 
      totalClients: uniqueClients.size, 
      totalLetters: filteredData.length,
      totalItemsDisputed, 
      totalItemsRemoved, 
      totalItemsVerified: 0, 
      totalItemsUpdated: 0, 
      totalFavorable, 
      favorableRate, 
      deletionRate 
    },
    byBureau,
    byRound,
    rawCount: data.length,
    filteredCount: filteredData.length
  };
}

function getMockMetrics() {
  return {
    summary: { totalClients: 127, totalItemsDisputed: 892, totalItemsRemoved: 534, totalItemsVerified: 178, totalItemsUpdated: 89, totalFavorable: 623, favorableRate: 70, deletionRate: 60 },
    byBureau: { equifax: { disputed: 298, removed: 182, favorable: 210 }, experian: { disputed: 297, removed: 176, favorable: 207 }, transunion: { disputed: 297, removed: 176, favorable: 206 } },
    byRound: { 1: { clients: 45, disputed: 312, removed: 187 }, 2: { clients: 38, disputed: 276, removed: 172 }, 3: { clients: 28, disputed: 198, removed: 118 }, 4: { clients: 16, disputed: 106, removed: 57 } },
    rawCount: 127,
    filteredCount: 127
  };
}
