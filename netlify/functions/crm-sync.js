// crm-sync.js - CRM MIGRATION PHASE 1 (Joe 8/8): pulls Pipedrive into the crm_*
// master tables. Modes: fields (enum vocabularies), persons, deals (incl. rounds).
// Notes/activities come in the next build. Incremental by update_time cursor
// (crm_sync_state); ?full=1 walks everything, max_pages per call + next_start so
// the backfill loops without timing out. Guard: ?key= must match PAYMENT_API_KEY.
const PD = process.env.PIPEDRIVE_API_KEY;
const SU = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SK = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: SK, Authorization: `Bearer ${SK}`, 'Content-Type': 'application/json' };
const PF = { current_status: '612856f2221d04679c1809eadb77b30300936445', update_status: '6381d902f9c164217fbb0b5a6b98f10f1bce7fad', quick_buttons: '928261a2cb90f4c404d6b7ab89a5542d8561350c', person1_reports: '92cdee6eca6d85d87904ff1fbf4c17f42f8a4f51', address: 'b42afe37cc9f83eff88d6b87a1be5a81cad64f31', account_manager: '0a2bceaec010dd949056d374970917a6b573f1dc' };
const DF = { payment_type: 'f58600db4c14bc33f67274903675226912efaa07', doc1: '314d267ebc05d3623ffd8aab701baae7bea29aa8', partial1: '35c626c805984517bacdba0b20aa20ab7ee3c48a', final1: '6a56ae5c67b53d1d25f0182790d7d84953a860c4', total_fee: '32ede4b1f12ad63d381425517a80af3430062502', partial_fee_date: 'ccdd8977ad68226523c02fabd395a2d5e09d7ed6', final_fee_date: '00e8800f0dd1d215fb9fddbe8c5b198ffc0b9c8e', final_invoice: '6390f0804b8be3b2469f3a175f5a2956d1be88da', agreement_link: 'c8c7a4092f620babba5070a2a90d819535d652ab', agreement_info: 'bc61560b919c05b5dc3a051267d630d7693c05d1', moved_into_pipeline: '505f65efbe301acd3c0d59f5523f4c738df85491' };
const ROUNDS = { RD1: '6979c70df67f42c28dfcff39284ae17d564d600f', RD3: '8d681007c089ee4c7390c02ee2f027ca60374708', RD4: '1d1bc8fbf1b8982640ef70131f010908788a7bd0', ARD1: '39ec0518ee030288f8ea6ddb9fb0ff62576d44c5' };
const respond = (c, b) => ({ statusCode: c, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
const num = (v) => (v === null || v === undefined || v === '') ? null : Number(v);
const primary = (arr) => Array.isArray(arr) ? ((arr.find(x => x.primary) || arr[0] || {}).value || null) : (arr || null);

async function pd(path) {
  const r = await fetch(`https://api.pipedrive.com/v1/${path}${path.includes('?') ? '&' : '?'}api_token=${PD}`);
  const j = await r.json().catch(() => ({}));
  if (!j.success) throw new Error(`PD ${path.split('?')[0]}: ${j.error || r.status}`);
  return j;
}
async function upsert(table, rows, conflict) {
  for (let i = 0; i < rows.length; i += 200) {
    // \u0000 (null bytes pasted into PD fields) are illegal in Postgres text - strip them
    const body = JSON.stringify(rows.slice(i, i + 200)).replace(/\\u0000/g, '');
    const r = await fetch(`${SU}/rest/v1/${table}?on_conflict=${conflict}`, { method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' }, body });
    if (!r.ok) throw new Error(`${table} upsert ${r.status}: ${(await r.text()).slice(0, 200)}`);
  }
}
async function getState(k) {
  const r = await fetch(`${SU}/rest/v1/crm_sync_state?key=eq.${k}&select=value`, { headers: H }).then(x => x.json()).catch(() => []);
  return (Array.isArray(r) && r[0] && r[0].value) || null;
}
async function setState(k, v) {
  await fetch(`${SU}/rest/v1/crm_sync_state?on_conflict=key`, { method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify([{ key: k, value: String(v), updated_at: new Date().toISOString() }]) });
}
async function userMap() {
  const j = await pd('users?limit=500');
  const m = {}; for (const u of (j.data || [])) m[u.id] = u.name; return m;
}

exports.handler = async (event) => {
  const q = event.queryStringParameters || {};
  if (q.key !== process.env.PAYMENT_API_KEY) return respond(401, { error: 'unauthorized' });
  const mode = q.mode || 'all';
  const full = q.full === '1';
  const maxPages = Math.min(parseInt(q.max_pages) || 4, 10);
  let start = parseInt(q.start) || 0;
  const out = { mode, full, start };
  try {
    if (mode === 'fields') {
      const opts = [];
      const dj = await pd('dealFields?limit=500'); const pj = await pd('personFields?limit=500');
      const want = [...Object.entries(PF), ...Object.entries(DF)];
      for (const [name, key] of want) {
        const f = [...(dj.data || []), ...(pj.data || [])].find(x => x.key === key);
        for (const o of ((f && f.options) || [])) opts.push({ field_key: name, option_id: o.id, label: o.label, synced_at: new Date().toISOString() });
      }
      await upsert('crm_field_options', opts, 'field_key,option_id');
      out.options_synced = opts.length;
      return respond(200, out);
    }
    if (mode === 'persons' || mode === 'all') {
      const users = await userMap();
      const cursor = full ? null : (await getState('persons_cursor'));
      let synced = 0, more = true, hitCursor = false, maxSeen = cursor || '';
      for (let p = 0; p < maxPages && more && !hitCursor; p++) {
        const j = await pd(`persons?limit=500&start=${start}&sort=update_time DESC`);
        const rows = [];
        for (const d of (j.data || [])) {
          if (cursor && d.update_time <= cursor) { hitCursor = true; break; }
          if (d.update_time > maxSeen) maxSeen = d.update_time;
          rows.push({
            pipedrive_person_id: d.id, name: d.name, email: primary(d.email), phone: primary(d.phone),
            address: d[PF.address] || null,
            current_status: num(d[PF.current_status]), update_status: num(d[PF.update_status]),
            quick_buttons: num(d[PF.quick_buttons]), person1_reports: num(d[PF.person1_reports]),
            account_manager_pd_id: num(d[PF.account_manager]), account_manager_name: users[num(d[PF.account_manager])] || null,
            owner_pd_id: d.owner_id && d.owner_id.id, owner_name: (d.owner_id && d.owner_id.name) || users[d.owner_id && d.owner_id.id] || null,
            pd_add_time: d.add_time || null, pd_update_time: d.update_time || null,
            synced_at: new Date().toISOString(), deleted: !!d.delete_time
          });
        }
        if (rows.length) { await upsert('crm_clients', rows, 'pipedrive_person_id'); synced += rows.length; }
        const pag = j.additional_data && j.additional_data.pagination;
        more = !!(pag && pag.more_items_in_collection);
        start = (pag && pag.next_start) || 0;
      }
      if (maxSeen && (!more || hitCursor)) await setState('persons_cursor', maxSeen);
      out.persons = { synced, done: !more || hitCursor, next_start: (!more || hitCursor) ? null : start };
      if (mode === 'persons') return respond(200, out);
      start = parseInt(q.start) || 0;
    }
    if (mode === 'deals' || mode === 'all') {
      const users = await userMap();
      const pls = {}; const sts = {};
      for (const p of ((await pd('pipelines')).data || [])) pls[p.id] = p.name;
      for (const s of ((await pd('stages?limit=500')).data || [])) sts[s.id] = s.name;
      const cursor = full ? null : (await getState('deals_cursor'));
      let synced = 0, roundsSynced = 0, more = true, hitCursor = false, maxSeen = cursor || '';
      for (let p = 0; p < maxPages && more && !hitCursor; p++) {
        const j = await pd(`deals?limit=500&start=${start}&sort=update_time DESC`);
        const rows = [], rrows = [];
        for (const d of (j.data || [])) {
          if (cursor && d.update_time <= cursor) { hitCursor = true; break; }
          if (d.update_time > maxSeen) maxSeen = d.update_time;
          rows.push({
            pipedrive_deal_id: d.id, pipedrive_person_id: (d.person_id && d.person_id.value) || d.person_id || null,
            title: d.title, status: d.status, pipeline_id: d.pipeline_id, pipeline_name: pls[d.pipeline_id] || null,
            stage_id: d.stage_id, stage_name: sts[d.stage_id] || null, stage_entered_at: d.stage_change_time || null,
            value: d.value || null, owner_pd_id: d.user_id && d.user_id.id, owner_name: (d.user_id && d.user_id.name) || users[d.user_id && d.user_id.id] || null,
            payment_type: num(d[DF.payment_type]), total_fee: d[DF.total_fee] || null,
            partial_fee_date: d[DF.partial_fee_date] || null, final_fee_date: d[DF.final_fee_date] || null,
            doc1: num(d[DF.doc1]), partial1: num(d[DF.partial1]), final1: num(d[DF.final1]),
            final_invoice: d[DF.final_invoice] || null, agreement_link: d[DF.agreement_link] || null, agreement_info: d[DF.agreement_info] || null,
            moved_into_pipeline: d[DF.moved_into_pipeline] || null,
            won_time: d.won_time || null, lost_time: d.lost_time || null,
            pd_add_time: d.add_time || null, pd_update_time: d.update_time || null,
            synced_at: new Date().toISOString(), deleted: d.status === 'deleted' || !!d.deleted
          });
          for (const [label, key] of Object.entries(ROUNDS)) {
            if (d[key]) rrows.push({ pipedrive_deal_id: d.id, round_label: label, start_date: d[key], end_date: d[key + '_until'] || null, synced_at: new Date().toISOString() });
          }
        }
        if (rows.length) { await upsert('crm_deals', rows, 'pipedrive_deal_id'); synced += rows.length; }
        if (rrows.length) { await upsert('crm_rounds', rrows, 'pipedrive_deal_id,round_label'); roundsSynced += rrows.length; }
        const pag = j.additional_data && j.additional_data.pagination;
        more = !!(pag && pag.more_items_in_collection);
        start = (pag && pag.next_start) || 0;
      }
      if (maxSeen && (!more || hitCursor)) await setState('deals_cursor', maxSeen);
      out.deals = { synced, rounds: roundsSynced, done: !more || hitCursor, next_start: (!more || hitCursor) ? null : start };
    }
    return respond(200, out);
  } catch (e) { return respond(500, { error: e.message, ...out }); }
};
