// crm-deep-verify.js - daily field-level spot audit (Joe 8/10).
// Samples random deals/persons changed in the last 48h, pulls each FRESH from
// Pipedrive, compares field-by-field against our mirror. PD is master, so any
// mismatch SELF-HEALS (our row is patched to PD truth) and the diff is recorded.
// Verdict -> crm_sync_state key last_deep_verify. Guard: ?key= PAYMENT_API_KEY.
const PD = process.env.PIPEDRIVE_API_KEY;
const SU = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SK = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: SK, Authorization: `Bearer ${SK}`, 'Content-Type': 'application/json' };
const DF = { payment_type: 'f58600db4c14bc33f67274903675226912efaa07', doc1: '314d267ebc05d3623ffd8aab701baae7bea29aa8', partial1: '35c626c805984517bacdba0b20aa20ab7ee3c48a', final1: '6a56ae5c67b53d1d25f0182790d7d84953a860c4', total_fee: '32ede4b1f12ad63d381425517a80af3430062502', partial_fee_date: 'ccdd8977ad68226523c02fabd395a2d5e09d7ed6', final_fee_date: '00e8800f0dd1d215fb9fddbe8c5b198ffc0b9c8e', final_invoice: '6390f0804b8be3b2469f3a175f5a2956d1be88da', agreement_link: 'c8c7a4092f620babba5070a2a90d819535d652ab', agreement_info: 'bc61560b919c05b5dc3a051267d630d7693c05d1', moved_into_pipeline: '505f65efbe301acd3c0d59f5523f4c738df85491' };
const PF = { current_status: '612856f2221d04679c1809eadb77b30300936445', update_status: '6381d902f9c164217fbb0b5a6b98f10f1bce7fad', quick_buttons: '928261a2cb90f4c404d6b7ab89a5542d8561350c', person1_reports: '92cdee6eca6d85d87904ff1fbf4c17f42f8a4f51', address: 'b42afe37cc9f83eff88d6b87a1be5a81cad64f31', account_manager: '0a2bceaec010dd949056d374970917a6b573f1dc' };
const ROUNDS = { RD1: '6979c70df67f42c28dfcff39284ae17d564d600f', RD3: '8d681007c089ee4c7390c02ee2f027ca60374708', RD4: '1d1bc8fbf1b8982640ef70131f010908788a7bd0', ARD1: '39ec0518ee030288f8ea6ddb9fb0ff62576d44c5' };
const respond = (c, b) => ({ statusCode: c, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
const norm = (v) => (v === null || v === undefined || v === '') ? null : String(v);
const primary = (arr) => Array.isArray(arr) ? ((arr.find(x => x.primary) || arr[0] || {}).value || null) : (arr || null);

async function pd(path) {
  const r = await fetch(`https://api.pipedrive.com/v1/${path}${path.includes('?') ? '&' : '?'}api_token=${PD}`);
  const j = await r.json().catch(() => ({}));
  if (!j.success) throw new Error(`PD ${path.split('?')[0]}: ${j.error || r.status}`);
  return j.data;
}
const sup = (p) => fetch(`${SU}/rest/v1/${p}`, { headers: H }).then(r => r.json());
const supPatch = (p, body) => fetch(`${SU}/rest/v1/${p}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(body) });
const supUpsert = (p, rows, conflict) => fetch(`${SU}/rest/v1/${p}?on_conflict=${conflict}`, { method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows) });

exports.handler = async (event) => {
  const q = event.queryStringParameters || {};
  if (q.key !== process.env.PAYMENT_API_KEY) return respond(401, { error: 'unauthorized' });
  const out = { ran_at: new Date().toISOString(), deals_checked: 0, persons_checked: 0, mismatches: [], healed: 0, errors: [] };
  try {
    const dealIds = await fetch(`${SU}/rest/v1/rpc/crm_sample_recent_deals`, { method: 'POST', headers: H, body: JSON.stringify({ n: parseInt(q.deals) || 25 }) }).then(r => r.json());
    for (const id of (Array.isArray(dealIds) ? dealIds : [])) {
      try {
        const [ours] = await sup(`crm_deals?pipedrive_deal_id=eq.${id}&select=*`);
        const theirs = await pd(`deals/${id}`);
        if (!ours || !theirs) { out.errors.push(`deal ${id}: missing side`); continue; }
        const want = {
          title: theirs.title, status: theirs.status,
          stage_id: theirs.stage_id, pipeline_id: theirs.pipeline_id,
          value: theirs.value || null,
          pipedrive_person_id: (theirs.person_id && theirs.person_id.value) || theirs.person_id || null,
          payment_type: theirs[DF.payment_type] ? parseInt(theirs[DF.payment_type]) : null,
          doc1: theirs[DF.doc1] ? parseInt(theirs[DF.doc1]) : null,
          partial1: theirs[DF.partial1] ? parseInt(theirs[DF.partial1]) : null,
          final1: theirs[DF.final1] ? parseInt(theirs[DF.final1]) : null,
          total_fee: theirs[DF.total_fee] || null,
          partial_fee_date: theirs[DF.partial_fee_date] || null,
          final_fee_date: theirs[DF.final_fee_date] || null,
          final_invoice: theirs[DF.final_invoice] || null,
          agreement_link: theirs[DF.agreement_link] || null,
          agreement_info: theirs[DF.agreement_info] || null,
          moved_into_pipeline: theirs[DF.moved_into_pipeline] || null
        };
        const fix = {};
        for (const [k, v] of Object.entries(want)) {
          if (norm(ours[k]) !== norm(v)) { out.mismatches.push({ type: 'deal', id, field: k, ours: ours[k], pd: v }); fix[k] = v; }
        }
        if (Object.keys(fix).length) {
          fix.pd_update_time = theirs.update_time || null; fix.synced_at = new Date().toISOString();
          await supPatch(`crm_deals?pipedrive_deal_id=eq.${id}`, fix); out.healed++;
        }
        // rounds
        const ourRounds = await sup(`crm_rounds?pipedrive_deal_id=eq.${id}&select=round_label,start_date,end_date`);
        const rByLabel = {}; for (const r of (ourRounds || [])) rByLabel[r.round_label] = r;
        const rFix = [];
        for (const [label, key] of Object.entries(ROUNDS)) {
          const ps = theirs[key] || null, pe = theirs[key + '_until'] || null;
          const o = rByLabel[label] || {};
          if (norm(o.start_date) !== norm(ps) || norm(o.end_date) !== norm(pe)) {
            if (ps) { out.mismatches.push({ type: 'round', id, field: label, ours: `${o.start_date || '-'}..${o.end_date || '-'}`, pd: `${ps}..${pe || '-'}` }); rFix.push({ pipedrive_deal_id: id, round_label: label, start_date: ps, end_date: pe, synced_at: new Date().toISOString() }); }
          }
        }
        if (rFix.length) { await supUpsert('crm_rounds', rFix, 'pipedrive_deal_id,round_label'); out.healed++; }
        out.deals_checked++;
      } catch (e) { out.errors.push(`deal ${id}: ${e.message}`); }
    }
    const personIds = await fetch(`${SU}/rest/v1/rpc/crm_sample_recent_persons`, { method: 'POST', headers: H, body: JSON.stringify({ n: parseInt(q.persons) || 15 }) }).then(r => r.json());
    for (const id of (Array.isArray(personIds) ? personIds : [])) {
      try {
        const [ours] = await sup(`crm_clients?pipedrive_person_id=eq.${id}&select=*`);
        const theirs = await pd(`persons/${id}`);
        if (!ours || !theirs) { out.errors.push(`person ${id}: missing side`); continue; }
        const want = {
          name: theirs.name, email: primary(theirs.email), phone: primary(theirs.phone),
          address: theirs[PF.address] || null,
          current_status: theirs[PF.current_status] ? parseInt(theirs[PF.current_status]) : null,
          update_status: theirs[PF.update_status] ? parseInt(theirs[PF.update_status]) : null,
          quick_buttons: theirs[PF.quick_buttons] ? parseInt(theirs[PF.quick_buttons]) : null,
          person1_reports: theirs[PF.person1_reports] ? parseInt(theirs[PF.person1_reports]) : null,
          account_manager_pd_id: theirs[PF.account_manager] ? parseInt(theirs[PF.account_manager]) : null
        };
        const fix = {};
        for (const [k, v] of Object.entries(want)) {
          if (norm(ours[k]) !== norm(v)) { out.mismatches.push({ type: 'person', id, field: k, ours: ours[k], pd: v }); fix[k] = v; }
        }
        if (Object.keys(fix).length) {
          fix.pd_update_time = theirs.update_time || null; fix.synced_at = new Date().toISOString();
          await supPatch(`crm_clients?pipedrive_person_id=eq.${id}`, fix); out.healed++;
        }
        out.persons_checked++;
      } catch (e) { out.errors.push(`person ${id}: ${e.message}`); }
    }
    out.clean = out.mismatches.length === 0 && out.errors.length === 0;
    await supUpsert('crm_sync_state', [{ key: 'last_deep_verify', value: JSON.stringify(out).slice(0, 30000), updated_at: new Date().toISOString() }], 'key');
    return respond(200, out);
  } catch (e) { out.errors.push(e.message); return respond(500, out); }
};
