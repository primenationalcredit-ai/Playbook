// approve-credit-submission.js
// Approves or rejects a credit-building submission.
// On approval, posts a Pipedrive note to the client's deal:
//   "Approved Secured Building Products - [product name]"
// One submission = one product = one note. Never double-posts (guarded by
// pipedrive_note_posted flag).

const PIPEDRIVE_TOKEN = process.env.PIPEDRIVE_API_KEY || '328f4866f7d86c2bfbee1ed8b5c1895a1f6444d0';
const PIPEDRIVE_DOMAIN = process.env.PIPEDRIVE_DOMAIN || 'asapcreditrepairusa';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

const supa = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

  try {
    const { submission_id, action, reviewed_by } = JSON.parse(event.body || '{}');
    if (!submission_id || !['approve', 'reject'].includes(action)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'submission_id and action (approve|reject) required' }) };
    }

    // Load submission
    const subRes = await fetch(`${SUPABASE_URL}/rest/v1/credit_building_submissions?id=eq.${submission_id}&select=*`, { headers: supa });
    const rows = subRes.ok ? await subRes.json() : [];
    const submission = rows[0];
    if (!submission) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Submission not found' }) };

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const patch = {
      status: newStatus,
      reviewed_by: reviewed_by || null,
      reviewed_at: new Date().toISOString()
    };

    let notePosted = false;
    let noteId = null;
    let noteSkippedReason = null;

    // Post Pipedrive note only on approval, only once, only with a deal id
    if (action === 'approve') {
      if (submission.pipedrive_note_posted) {
        noteSkippedReason = 'already_posted';
      } else if (!submission.pipedrive_deal_id) {
        noteSkippedReason = 'no_deal_id';
      } else {
        const content = `Approved Secured Building Products - ${submission.product_name || 'Credit Building Product'}`;
        try {
          const noteRes = await fetch(`https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/notes?api_token=${PIPEDRIVE_TOKEN}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deal_id: Number(submission.pipedrive_deal_id), content })
          });
          const noteData = await noteRes.json();
          if (noteRes.ok && noteData.success && noteData.data?.id) {
            notePosted = true;
            noteId = noteData.data.id;
            patch.pipedrive_note_posted = true;
            patch.pipedrive_note_id = String(noteId);
          } else {
            noteSkippedReason = 'pipedrive_error: ' + JSON.stringify(noteData).slice(0, 200);
          }
        } catch (e) {
          noteSkippedReason = 'pipedrive_exception: ' + e.message;
        }
      }
    }

    // Update submission status (and note flags if posted)
    const updRes = await fetch(`${SUPABASE_URL}/rest/v1/credit_building_submissions?id=eq.${submission_id}`, {
      method: 'PATCH',
      headers: { ...supa, Prefer: 'return=minimal' },
      body: JSON.stringify(patch)
    });
    if (!updRes.ok) {
      const t = await updRes.text();
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Status update failed: ' + t }) };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, status: newStatus, notePosted, noteId, noteSkippedReason })
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
