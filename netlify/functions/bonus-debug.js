const PIPEDRIVE_API_KEY = process.env.PIPEDRIVE_API_KEY;
const PIPEDRIVE_DOMAIN = process.env.PIPEDRIVE_DOMAIN || 'asapcreditrepair';
const ORG_EMAIL_FIELD = 'ba6dfecbc8c99e28eefa892a929f317156c36474';

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  try {
    // Get org label definitions
    const fieldsRes = await fetch(`https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/organizationFields?api_token=${PIPEDRIVE_API_KEY}&limit=500`);
    const fieldsData = await fieldsRes.json();
    const labelField = (fieldsData.data || []).find(f => f.key === 'label');
    
    // Get a few orgs to see their label values
    const orgsRes = await fetch(`https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/organizations?sort=update_time DESC&limit=10&api_token=${PIPEDRIVE_API_KEY}`);
    const orgsData = await orgsRes.json();
    
    const samples = (orgsData.data || []).map(o => ({
      name: o.name,
      label: o.label,
      label_type: typeof o.label,
      email_field: o[ORG_EMAIL_FIELD],
      has_email: !!(o[ORG_EMAIL_FIELD] && String(o[ORG_EMAIL_FIELD]).includes('@'))
    }));

    return {
      statusCode: 200, headers,
      body: JSON.stringify({ 
        labelFieldOptions: labelField?.options || 'not found',
        orgSamples: samples 
      }, null, 2)
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
