// Client Pipeline Metrics - Pulls live data from Pipedrive
const PIPEDRIVE_API_KEY = process.env.PIPEDRIVE_API_KEY;
const PIPEDRIVE_DOMAIN = process.env.PIPEDRIVE_DOMAIN || 'asapcreditrepair';
const BASE_URL = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1`;

const PIPELINES = {
  21: { name: 'New Leads', order: 0, color: '#6366F1' },
  42: { name: 'Quoted', order: 1, color: '#F59E0B' },
  7:  { name: 'Sold', order: 2, color: '#10B981' },
  45: { name: 'C.R.S.', order: 3, color: '#3B82F6' }
};

async function pdFetch(endpoint) {
  const url = `${BASE_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}api_token=${PIPEDRIVE_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Pipedrive ${endpoint}: ${res.status}`);
  return await res.json();
}

async function getDealsInPipeline(pipelineId, status = 'open') {
  let allDeals = [];
  let start = 0;
  let hasMore = true;
  
  while (hasMore) {
    const data = await pdFetch(`/pipelines/${pipelineId}/deals?status=${status}&start=${start}&limit=500`);
    if (data.data) allDeals = allDeals.concat(data.data);
    hasMore = data.additional_data?.pagination?.more_items_in_collection || false;
    start += 500;
    if (start > 5000) break; // Safety
  }
  return allDeals;
}

async function getStagesForPipeline(pipelineId) {
  const data = await pdFetch(`/stages?pipeline_id=${pipelineId}`);
  return data.data || [];
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  try {
    const results = { pipelines: [], summary: {}, byConsultant: {}, updatedAt: new Date().toISOString() };
    let totalOpen = 0;
    let totalWon = 0;
    let totalLost = 0;

    for (const [pipelineId, meta] of Object.entries(PIPELINES)) {
      const pid = parseInt(pipelineId);
      
      // Get stages
      const stages = await getStagesForPipeline(pid);
      
      // Get open deals
      const openDeals = await getDealsInPipeline(pid, 'open');
      
      // Get won deals (this month)
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      
      // Count per stage
      const stageCounts = {};
      const stageValues = {};
      stages.forEach(s => { stageCounts[s.id] = { name: s.name, count: 0, value: 0 }; });
      
      const consultantCounts = {};
      
      openDeals.forEach(deal => {
        if (stageCounts[deal.stage_id]) {
          stageCounts[deal.stage_id].count++;
          stageCounts[deal.stage_id].value += (deal.value || 0);
        }
        
        // By consultant (owner)
        const owner = deal.owner_name || 'Unassigned';
        if (!consultantCounts[owner]) consultantCounts[owner] = 0;
        consultantCounts[owner]++;
        
        // Global consultant tracking
        if (!results.byConsultant[owner]) results.byConsultant[owner] = { total: 0, pipelines: {} };
        results.byConsultant[owner].total++;
        if (!results.byConsultant[owner].pipelines[meta.name]) results.byConsultant[owner].pipelines[meta.name] = 0;
        results.byConsultant[owner].pipelines[meta.name]++;
      });

      // Calculate average deal age
      let totalAge = 0;
      openDeals.forEach(deal => {
        if (deal.add_time) {
          const addDate = new Date(deal.add_time);
          const daysDiff = Math.floor((now - addDate) / (1000 * 60 * 60 * 24));
          totalAge += daysDiff;
        }
      });
      const avgAge = openDeals.length > 0 ? Math.round(totalAge / openDeals.length) : 0;

      totalOpen += openDeals.length;

      results.pipelines.push({
        id: pid,
        name: meta.name,
        color: meta.color,
        order: meta.order,
        openCount: openDeals.length,
        totalValue: openDeals.reduce((sum, d) => sum + (d.value || 0), 0),
        avgAge,
        stages: Object.values(stageCounts).filter(s => s.count > 0).sort((a, b) => b.count - a.count),
        byConsultant: consultantCounts
      });
    }

    // Get summary stats
    // Won deals this month across all pipelines
    try {
      const wonData = await pdFetch(`/deals?status=won&sort=won_time DESC&limit=100`);
      const wonDeals = wonData.data || [];
      const thisMonth = new Date();
      const monthStr = `${thisMonth.getFullYear()}-${String(thisMonth.getMonth() + 1).padStart(2, '0')}`;
      totalWon = wonDeals.filter(d => d.won_time && d.won_time.startsWith(monthStr)).length;
    } catch (e) {
      console.log('Failed to get won deals:', e.message);
    }

    // Lost deals this month
    try {
      const lostData = await pdFetch(`/deals?status=lost&sort=lost_time DESC&limit=100`);
      const lostDeals = lostData.data || [];
      const thisMonth = new Date();
      const monthStr = `${thisMonth.getFullYear()}-${String(thisMonth.getMonth() + 1).padStart(2, '0')}`;
      totalLost = lostDeals.filter(d => d.lost_time && d.lost_time.startsWith(monthStr)).length;
    } catch (e) {
      console.log('Failed to get lost deals:', e.message);
    }

    results.summary = { totalOpen, totalWon, totalLost };
    results.pipelines.sort((a, b) => a.order - b.order);

    return { statusCode: 200, headers, body: JSON.stringify(results) };
  } catch (error) {
    console.error('Pipeline metrics error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};
