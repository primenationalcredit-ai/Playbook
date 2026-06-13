// Pipedrive Daily Sync
// Runs as scheduled function to ensure data consistency
// Also provides manual sync endpoint

const { createClient } = require('@supabase/supabase-js');

const PIPEDRIVE_API_KEY = process.env.PIPEDRIVE_API_KEY;
const PIPEDRIVE_DOMAIN = process.env.PIPEDRIVE_DOMAIN || 'asapcreditrepair';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Label mappings
const ESCALATION_LABELS = {
  'ESC - Open': 'open',
  'ESC - Resolved (No Refund)': 'resolved_no_refund',
  'ESC - Resolved (Partial Refund)': 'resolved_partial_refund',
  'ESC - Resolved (Full Refund)': 'resolved_full_refund'
};

const ERROR_LABELS = {
  'ERR - Documentation': 'documentation',
  'ERR - Processing': 'processing',
  'ERR - Communication': 'communication',
  'ERR - Billing': 'billing',
  'ERR - Other': 'other'
};

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Initialize clients
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Supabase credentials not configured' })
    };
  }

  if (!PIPEDRIVE_API_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Pipedrive API key not configured' })
    };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const results = {
      deals: { synced: 0, errors: 0 },
      persons: { synced: 0, errors: 0 },
      escalations: { found: 0 },
      errorLabels: { found: 0 },
      timestamp: new Date().toISOString()
    };

    // 1. Sync all deals for retention tracking
    console.log('Syncing deals...');
    let dealsStart = 0;
    let hasMoreDeals = true;
    
    while (hasMoreDeals) {
      const dealsResponse = await fetch(
        `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/deals?api_token=${PIPEDRIVE_API_KEY}&start=${dealsStart}&limit=500`
      );
      const dealsData = await dealsResponse.json();
      
      if (!dealsData.success || !dealsData.data?.length) {
        hasMoreDeals = false;
        break;
      }

      for (const deal of dealsData.data) {
        const { error } = await supabase
          .from('pipedrive_deals')
          .upsert({
            pipedrive_deal_id: deal.id.toString(),
            pipedrive_person_id: deal.person_id?.toString(),
            title: deal.title,
            client_name: deal.person_name,
            status: deal.status,
            value: deal.value,
            owner_id: deal.owner_id?.toString(),
            stage_id: deal.stage_id?.toString(),
            pipeline_id: deal.pipeline_id?.toString(),
            created_at: deal.add_time,
            won_at: deal.won_time,
            lost_at: deal.lost_time,
            lost_reason: deal.lost_reason,
            last_synced_at: new Date().toISOString()
          }, {
            onConflict: 'pipedrive_deal_id'
          });

        if (error) {
          results.deals.errors++;
        } else {
          results.deals.synced++;
        }
      }

      hasMoreDeals = dealsData.additional_data?.pagination?.more_items_in_collection;
      dealsStart += 500;
    }

    // 2. Sync persons and check for labels
    console.log('Syncing persons and checking labels...');
    let personsStart = 0;
    let hasMorePersons = true;

    while (hasMorePersons) {
      const personsResponse = await fetch(
        `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/persons?api_token=${PIPEDRIVE_API_KEY}&start=${personsStart}&limit=500`
      );
      const personsData = await personsResponse.json();

      if (!personsData.success || !personsData.data?.length) {
        hasMorePersons = false;
        break;
      }

      for (const person of personsData.data) {
        results.persons.synced++;
        
        // Check for labels (the field name may vary in your Pipedrive)
        const labels = person.label || person.labels || [];
        const labelArray = Array.isArray(labels) ? labels : (labels ? [labels] : []);

        // Check each label
        for (const label of labelArray) {
          const labelName = typeof label === 'string' ? label : label?.name;
          
          // Check escalation labels
          if (ESCALATION_LABELS[labelName]) {
            results.escalations.found++;
            await supabase
              .from('pipedrive_escalations')
              .upsert({
                pipedrive_person_id: person.id.toString(),
                client_name: person.name,
                client_email: person.email?.[0]?.value,
                status: ESCALATION_LABELS[labelName],
                last_synced_at: new Date().toISOString()
              }, {
                onConflict: 'pipedrive_person_id'
              });
          }

          // Check error labels
          if (ERROR_LABELS[labelName]) {
            results.errorLabels.found++;
            // For errors, we check if one already exists for this person/type combo today
            const today = new Date().toISOString().split('T')[0];
            const { data: existing } = await supabase
              .from('pipedrive_errors')
              .select('id')
              .eq('pipedrive_person_id', person.id.toString())
              .eq('error_type', ERROR_LABELS[labelName])
              .gte('flagged_at', today)
              .single();

            if (!existing) {
              await supabase
                .from('pipedrive_errors')
                .insert({
                  pipedrive_person_id: person.id.toString(),
                  client_name: person.name,
                  error_type: ERROR_LABELS[labelName],
                  flagged_at: new Date().toISOString(),
                  last_synced_at: new Date().toISOString()
                });
            }
          }
        }
      }

      hasMorePersons = personsData.additional_data?.pagination?.more_items_in_collection;
      personsStart += 500;
    }

    // 3. Calculate and store daily KPI snapshot
    console.log('Calculating KPI snapshot...');
    await calculateDailyKPIs(supabase);

    console.log('Sync completed:', results);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Daily sync completed',
        results
      })
    };

  } catch (error) {
    console.error('Sync error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};

// Calculate and store daily KPI snapshots
async function calculateDailyKPIs(supabase) {
  const today = new Date().toISOString().split('T')[0];

  // Get deal stats for retention
  const { data: deals } = await supabase
    .from('pipedrive_deals')
    .select('status');

  const totalDeals = deals?.length || 0;
  const wonDeals = deals?.filter(d => d.status === 'won').length || 0;
  const lostDeals = deals?.filter(d => d.status === 'lost').length || 0;
  const retentionRate = totalDeals > 0 ? (wonDeals / (wonDeals + lostDeals)) * 100 : 0;

  // Get escalation stats
  const { data: escalations } = await supabase
    .from('pipedrive_escalations')
    .select('status');

  const totalEscalations = escalations?.length || 0;
  const resolvedNoRefund = escalations?.filter(e => e.status === 'resolved_no_refund').length || 0;
  const resolvedCount = escalations?.filter(e => e.status !== 'open').length || 0;
  const escalationResolutionRate = totalEscalations > 0 ? (resolvedNoRefund / resolvedCount) * 100 : 0;

  // Get error stats
  const { data: errors } = await supabase
    .from('pipedrive_errors')
    .select('error_type, is_resolved');

  const totalErrors = errors?.length || 0;
  const resolvedErrors = errors?.filter(e => e.is_resolved).length || 0;

  // Store KPI snapshots
  const kpis = [
    {
      period_type: 'daily',
      period_start: today,
      period_end: today,
      department: 'leadership',
      metric_name: 'client_retention_rate',
      metric_value: retentionRate.toFixed(2),
      metric_target: 70,
      metric_unit: 'percent',
      details: { total: totalDeals, won: wonDeals, lost: lostDeals }
    },
    {
      period_type: 'daily',
      period_start: today,
      period_end: today,
      department: 'leadership',
      metric_name: 'escalation_resolution_rate',
      metric_value: escalationResolutionRate.toFixed(2),
      metric_target: 95,
      metric_unit: 'percent',
      details: { total: totalEscalations, resolved: resolvedCount, no_refund: resolvedNoRefund }
    },
    {
      period_type: 'daily',
      period_start: today,
      period_end: today,
      department: 'leadership',
      metric_name: 'total_errors',
      metric_value: totalErrors,
      metric_target: 0,
      metric_unit: 'count',
      details: { total: totalErrors, resolved: resolvedErrors }
    }
  ];

  for (const kpi of kpis) {
    await supabase
      .from('kpi_snapshots')
      .upsert(kpi, {
        onConflict: 'period_type,period_start,department,metric_name'
      });
  }
}
