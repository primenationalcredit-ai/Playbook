import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { GitBranch, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';

// Pipelines - the Pipedrive pipeline view mirrored on our own data (Joe 8/10).
// Faithful first, simplify later: same pipelines, same stages, same counts -
// with a live verification banner (ours vs Pipedrive's own open total).
function Pipelines() {
  const [data, setData] = useState(null);
  const [activePipe, setActivePipe] = useState(null);
  const [stageDeals, setStageDeals] = useState({});
  const [openStage, setOpenStage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess && sess.session && sess.session.access_token;
        const res = await fetch('/.netlify/functions/crm-pipeline-verify', { headers: { Authorization: `Bearer ${token}` } });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
        setData(j);
        const pipes = [...new Set((j.counts || []).map(c => c.pipeline_id))];
        if (pipes.length) setActivePipe(pipes[0]);
      } catch (e) { setData({ error: e.message }); }
      setLoading(false);
    };
    load();
  }, []);

  const toggleStage = async (pid, sid) => {
    const key = `${pid}:${sid}`;
    if (openStage === key) { setOpenStage(null); return; }
    setOpenStage(key);
    if (!stageDeals[key]) {
      const { data: ds } = await supabase.from('crm_deals')
        .select('pipedrive_deal_id,title,owner_name,value,pipedrive_person_id,stage_entered_at')
        .eq('status', 'open').eq('deleted', false).eq('pipeline_id', pid).eq('stage_id', sid)
        .order('stage_entered_at', { ascending: true, nullsFirst: true }).limit(200);
      setStageDeals({ ...stageDeals, [key]: ds || [] });
    }
  };

  if (loading) return <div className="p-6 flex items-center gap-2 text-gray-500"><Loader2 className="w-5 h-5 animate-spin" /> Loading pipelines...</div>;
  if (!data || data.error) return <div className="p-6 text-red-600">Failed to load: {data && data.error}</div>;

  const byPipe = {};
  for (const c of (data.counts || [])) {
    if (!byPipe[c.pipeline_id]) byPipe[c.pipeline_id] = { name: c.pipeline_name || `Pipeline ${c.pipeline_id}`, stages: [], total: 0 };
    byPipe[c.pipeline_id].stages.push(c);
    byPipe[c.pipeline_id].total += Number(c.open_count || 0);
  }
  const pipeIds = Object.keys(byPipe).sort((a, b) => byPipe[b].total - byPipe[a].total);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-1"><GitBranch className="w-6 h-6 text-blue-600" /><h1 className="text-2xl font-bold">Pipelines</h1></div>
      <div className={`my-3 rounded-lg border p-3 text-sm flex items-center gap-2 ${data.match === true ? 'bg-green-50 border-green-200 text-green-800' : data.match === false ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
        {data.match === true ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
        {data.match === true && <span><b>Verified:</b> {data.our_total.toLocaleString()} open deals - exactly matches Pipedrive.</span>}
        {data.match === false && <span><b>Count check:</b> ours {data.our_total.toLocaleString()} vs Pipedrive {Number(data.pd_total).toLocaleString()} - difference of {Math.abs(data.our_total - data.pd_total).toLocaleString()} (recent movements may be in flight; a persistent gap means a sync issue).</span>}
        {data.match === null && <span>Ours: {data.our_total.toLocaleString()} open deals (Pipedrive total unavailable right now).</span>}
      </div>
      <div className="flex gap-2 flex-wrap mb-5">
        {pipeIds.map(pid => (
          <button key={pid} onClick={() => { setActivePipe(Number(pid)); setOpenStage(null); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${Number(pid) === activePipe ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>
            {byPipe[pid].name} <span className="opacity-70">({byPipe[pid].total.toLocaleString()})</span>
          </button>
        ))}
      </div>
      {activePipe !== null && byPipe[activePipe] && (
        <div className="flex gap-3 overflow-x-auto pb-3">
          {byPipe[activePipe].stages.sort((a, b) => (a.stage_order ?? a.stage_id) - (b.stage_order ?? b.stage_id)).map(st => {
            const key = `${activePipe}:${st.stage_id}`;
            return (
              <div key={st.stage_id} className="min-w-[240px] max-w-[280px] flex-shrink-0">
                <button onClick={() => toggleStage(activePipe, st.stage_id)}
                  className={`w-full text-left rounded-t-lg px-3 py-2 border ${openStage === key ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-100 border-gray-200 hover:bg-gray-200'}`}>
                  <div className="text-sm font-semibold truncate">{st.stage_name || `Stage ${st.stage_id}`}</div>
                  <div className={`text-xs ${openStage === key ? 'text-blue-100' : 'text-gray-500'}`}>{Number(st.open_count).toLocaleString()} open</div>
                </button>
                {openStage === key && (
                  <div className="border border-t-0 rounded-b-lg bg-white max-h-[420px] overflow-y-auto divide-y">
                    {!stageDeals[key] && <div className="p-3 text-xs text-gray-400 flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Loading...</div>}
                    {(stageDeals[key] || []).map(d => (
                      <Link key={d.pipedrive_deal_id} to={`/clients?person=${d.pipedrive_person_id}&deal=${d.pipedrive_deal_id}`} className="block p-2.5 hover:bg-blue-50">
                        <div className="text-sm font-medium truncate">{d.title}</div>
                        <div className="text-xs text-gray-500">#{d.pipedrive_deal_id} {d.owner_name ? `- ${d.owner_name}` : ''} {d.value ? `- $${Number(d.value).toLocaleString()}` : ''}</div>
                      </Link>
                    ))}
                    {stageDeals[key] && stageDeals[key].length === 200 && <div className="p-2 text-xs text-gray-400 text-center">first 200 shown</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
export default Pipelines;
