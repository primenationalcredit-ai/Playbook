// Test what's coming from Google Sheet
// URL: /.netlify/functions/sales-sheet-test

const SHEET_ID = '1Z_e9cIUZWPKsV0zIMCQvOu2mjIu19YyCsv3ZOBmJ48Y';

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  const params = event.queryStringParameters || {};
  const gid = params.gid || '24680817'; // Default GID, can be overridden

  // Try multiple URL formats
  const urls = [
    { name: 'gviz', url: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${gid}` },
    { name: 'export', url: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}` },
    { name: 'pub_csv', url: `https://docs.google.com/spreadsheets/d/e/2PACX-1vS/pub?gid=${gid}&single=true&output=csv` },
  ];

  const results = [];

  for (const { name, url } of urls) {
    try {
      console.log(`Trying ${name}: ${url}`);
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0'
        }
      });
      
      const text = await response.text();
      const lines = text.split('\n').filter(l => l.trim());
      
      results.push({
        method: name,
        url: url,
        status: response.status,
        content_type: response.headers.get('content-type'),
        total_chars: text.length,
        total_lines: lines.length,
        first_line: lines[0]?.substring(0, 200) || '(empty)',
        second_line: lines[1]?.substring(0, 200) || '(empty)',
        looks_like_csv: text.includes(',') && !text.includes('<!DOCTYPE'),
        looks_like_html: text.includes('<!DOCTYPE') || text.includes('<html')
      });
    } catch (error) {
      results.push({
        method: name,
        url: url,
        error: error.message
      });
    }
  }

  // Also try to list all sheets/tabs
  let tabInfo = null;
  try {
    // This URL sometimes returns tab info
    const metaUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`;
    // Can't easily get tab list without API, but we can suggest checking manually
    tabInfo = "Check your sheet URL when on Data Export tab to get the correct gid";
  } catch (e) {
    tabInfo = e.message;
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      sheet_id: SHEET_ID,
      requested_gid: gid,
      tab_info: tabInfo,
      results,
      suggestion: "If all methods show 0 lines or HTML, the sheet may not be published. Go to File > Share > Publish to web and publish the Data Export tab as CSV."
    }, null, 2)
  };
};
