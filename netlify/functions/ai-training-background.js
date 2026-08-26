// ai-training-background.js - builds the course from the newest approved SOP.
// SCHEMA IS EXACT (read from AdminTrainingCourse.jsx, not guessed):
//   training_courses      title, description, departments[], due_days, created_by, is_published
//   training_modules      course_id, title, description, sort_order
//   training_lessons      module_id, title, content, video_url, image_url, sort_order
//   training_quizzes      module_id, title, passing_score
//   training_quiz_questions quiz_id, question, question_type, options[], correct_answer, sort_order
// correct_answer is the OPTION INDEX (TrainingCourse.jsx compares quizAnswers[i] === correct_answer).
const SU = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SK = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const AK = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;
const BKEY = process.env.PAYMENT_API_KEY || process.env.PIPEDRIVE_API_KEY || '';
const H = { apikey: SK, Authorization: `Bearer ${SK}`, 'Content-Type': 'application/json' };
const post = (t, b) => fetch(`${SU}/rest/v1/${t}`, { method: 'POST', headers: { ...H, Prefer: 'return=representation' }, body: JSON.stringify(b) }).then(r => r.json()).catch(() => null);
async function save(nonce, val) {
  await fetch(`${SU}/rest/v1/app_cache?cache_key=eq.${encodeURIComponent('trn_' + nonce)}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' },
    body: JSON.stringify({ cache_value: JSON.stringify(val), updated_at: new Date().toISOString() }) });
}
exports.handler = async (event) => {
  let nonce = null;
  try {
    const body = JSON.parse(event.body || '{}');
    nonce = body.nonce;
    if (!nonce || !BKEY || body.key !== BKEY) return { statusCode: 401, body: 'no' };
    const rows = await fetch(`${SU}/rest/v1/project_cards?id=eq.${encodeURIComponent(body.card_id)}&select=title,links`, { headers: H }).then(r => r.json());
    const card = Array.isArray(rows) && rows[0];
    if (!card) { await save(nonce, { status: 'error', error: 'card not found' }); return { statusCode: 200, body: 'err' }; }
    const sops = (Array.isArray(card.links) ? card.links : []).filter(l => l && l.sop && l.content);
    if (!sops.length) { await save(nonce, { status: 'error', error: 'no approved SOP on this project' }); return { statusCode: 200, body: 'err' }; }
    sops.sort((a, b2) => String(b2.at || '').localeCompare(String(a.at || '')));
    const sop = sops[0];
    const prompt = 'Turn the Standard Operating Procedure below into a training course for ASAP Credit Repair employees who have never used this feature.\n\nReturn ONLY a JSON object, no preamble and no markdown fence:\n{"title":"...","description":"1-2 sentences","modules":[{"title":"...","description":"one line","lessons":[{"title":"...","content":"the teaching text in markdown, 150-400 words, written to the employee in second person, concrete, naming the exact screens and buttons the SOP names"}]}],"quiz":{"title":"...","passing_score":80,"questions":[{"question":"a SCENARIO - describe a real situation and ask what they should do","options":["a","b","c","d"],"correct_answer":0}]}}\n\nRULES:\n- 2 to 4 modules, 2 to 4 lessons each. One quiz, 6 to 10 questions.\n- correct_answer is the INDEX (0-3) of the right option, never the text.\n- Questions must be SCENARIOS ("A client calls and says X - what do you do?"), not definition recall. Wrong options must be plausible mistakes a real employee would make, not obvious filler.\n- Teach ONLY what the SOP contains. Never invent a screen, button, or step. If the SOP marks something as not yet available, leave it out entirely.\n\nSOP TITLE: ' + (sop.label || 'SOP') + ' for ' + card.title + '\n\nSOP:\n' + String(sop.content).slice(0, 50000);
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'x-api-key': AK, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 12000, messages: [{ role: 'user', content: prompt }] })
    });
    const data = await res.json().catch(() => ({}));
    let raw = (data.content || []).filter(b2 => b2.type === 'text').map(b2 => b2.text).join('\n').trim();
    if (!res.ok || !raw) { await save(nonce, { status: 'error', error: (data.error && data.error.message) || ('anthropic ' + res.status) }); return { statusCode: 200, body: 'err' }; }
    raw = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const s0 = raw.indexOf('{'), e0 = raw.lastIndexOf('}');
    if (s0 > -1 && e0 > s0) raw = raw.slice(s0, e0 + 1);
    let plan; try { plan = JSON.parse(raw); } catch (e) { await save(nonce, { status: 'error', error: 'could not parse the generated course' }); return { statusCode: 200, body: 'err' }; }
    const course = await post('training_courses', { title: plan.title || ('Training: ' + card.title), description: plan.description || '', departments: ['everyone'], due_days: 7, created_by: body.created_by, is_published: false });
    const courseId = Array.isArray(course) && course[0] && course[0].id;
    if (!courseId) { await save(nonce, { status: 'error', error: 'could not create the course: ' + String(JSON.stringify(course)).slice(0, 300) }); return { statusCode: 200, body: 'err' }; }
    let lessonCount = 0, qCount = 0;
    const mods = Array.isArray(plan.modules) ? plan.modules : [];
    for (let i = 0; i < mods.length; i++) {
      const m = await post('training_modules', { course_id: courseId, title: mods[i].title || ('Module ' + (i + 1)), description: mods[i].description || '', sort_order: i });
      const mid = Array.isArray(m) && m[0] && m[0].id;
      if (!mid) continue;
      const les = Array.isArray(mods[i].lessons) ? mods[i].lessons : [];
      for (let j = 0; j < les.length; j++) {
        await post('training_lessons', { module_id: mid, title: les[j].title || ('Lesson ' + (j + 1)), content: les[j].content || '', video_url: '', image_url: '', sort_order: j });
        lessonCount++;
      }
      if (i === mods.length - 1 && plan.quiz && Array.isArray(plan.quiz.questions) && plan.quiz.questions.length) {
        const qz = await post('training_quizzes', { module_id: mid, title: plan.quiz.title || 'Scenario check', passing_score: plan.quiz.passing_score || 80 });
        const qid = Array.isArray(qz) && qz[0] && qz[0].id;
        if (qid) {
          for (let k = 0; k < plan.quiz.questions.length; k++) {
            const q = plan.quiz.questions[k];
            const opts = Array.isArray(q.options) ? q.options : [];
            let ci = Number(q.correct_answer);
            if (!Number.isInteger(ci) || ci < 0 || ci >= opts.length) ci = 0;
            await post('training_quiz_questions', { quiz_id: qid, question: q.question || '', options: opts, correct_answer: ci, sort_order: k });
            qCount++;
          }
        }
      }
    }
    await save(nonce, { status: 'done', course_id: courseId, title: plan.title, modules: mods.length, lessons: lessonCount, questions: qCount });
    return { statusCode: 200, body: 'ok' };
  } catch (e) { if (nonce) await save(nonce, { status: 'error', error: e.message }).catch(() => {}); return { statusCode: 200, body: 'err' }; }
};
