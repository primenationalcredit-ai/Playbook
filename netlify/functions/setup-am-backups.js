// ONE-TIME SETUP: Assigns backup users for all Account Manager tasks
// Based on the "When an Account Manager is OUT for the day" document
// Run once after deploy: /.netlify/functions/setup-am-backups
//
// This function:
// 1. Looks up user IDs for Dex-Ann, Zairen, Raquel, Bryan
// 2. Scans all task_templates assigned to each AM
// 3. Matches task titles to coverage rules from the document
// 4. Sets backup_user_1 (and backup_user_2 for timed calls)

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kkcbpqbcpzcarxhknzza.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function supabaseFetch(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
  });
  return res.json();
}

async function supabasePatch(table, query, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(data)
  });
  return res.json();
}

// Coverage rules from the document
// Key: who's out → task keyword → backup_user_1, backup_user_2
function getCoverageRules(userIds) {
  const { dex, zairen, raquel, bryan } = userIds;
  
  return {
    // === IF DEX IS OUT ===
    [dex]: {
      'intro':        { b1: raquel },
      'result':       { b1: raquel },    // Dex's Results
      'account':      { b1: raquel },    // Accounts All Day
      'sold':         { b1: zairen },
      'lnr':          { b1: zairen },
      'login':        { b1: zairen },    // Logins Not Ready = LNR
      'crs':          { b1: zairen },    // Crs Rc All Day
      'cr ':          { b1: zairen },    // Alternate CR spelling
      'payment':      { b1: bryan },
      'missing doc':  { b1: bryan },
      'missed call':  { b1: bryan },
      'timed call':   { b1: raquel, b2: zairen },  // All AMs help
      'timed':        { b1: raquel, b2: zairen },
    },
    
    // === IF ZAIREN IS OUT ===
    [zairen]: {
      'sold':         { b1: dex },
      'intro':        { b1: dex },
      'result':       { b1: dex },       // Results Blast filter
      'missed call':  { b1: dex },
      'missing doc':  { b1: raquel },
      'rd1':          { b1: raquel },    // RD1 Results
      'crs':          { b1: raquel },
      'cr ':          { b1: raquel },
      'no activity':  { b1: raquel },
      'payment':      { b1: bryan },
      'account':      { b1: bryan },
      'lnr':          { b1: bryan },
      'login':        { b1: bryan },
      'timed call':   { b1: dex, b2: raquel },
      'timed':        { b1: dex, b2: raquel },
    },
    
    // === IF RAQUEL IS OUT ===
    [raquel]: {
      'rd1':          { b1: zairen },
      'result':       { b1: zairen },
      'lnr':          { b1: zairen },
      'login':        { b1: zairen },
      'crs':          { b1: zairen },
      'cr ':          { b1: zairen },
      'no activity':  { b1: zairen },
      'sold':         { b1: dex },
      'missing doc':  { b1: dex },
      'account':      { b1: dex },
      'payment':      { b1: bryan },
      'missed call':  { b1: bryan },
      'intro':        { b1: bryan },
      'timed call':   { b1: zairen, b2: dex },
      'timed':        { b1: zairen, b2: dex },
    },
    
    // === IF BRYAN IS OUT ===
    [bryan]: {
      'sold':         { b1: dex },
      'lnr':          { b1: dex },
      'login':        { b1: dex },
      'result':       { b1: dex },       // Results Blast filter
      'missed call':  { b1: dex },
      'payment':      { b1: zairen },
      'intro':        { b1: zairen },
      'crs':          { b1: zairen },
      'cr ':          { b1: zairen },
      'no activity':  { b1: zairen },
      'rd1':          { b1: raquel },
      'account':      { b1: raquel },
      'missing doc':  { b1: raquel },
      'timed call':   { b1: dex, b2: zairen },
      'timed':        { b1: dex, b2: zairen },
    }
  };
}

// Match a task title to a coverage keyword (most specific match wins)
function findBackup(taskTitle, rules) {
  const title = taskTitle.toLowerCase();
  
  // Priority order: longer/more specific keywords first
  const keywords = Object.keys(rules).sort((a, b) => b.length - a.length);
  
  for (const keyword of keywords) {
    if (title.includes(keyword)) {
      return rules[keyword];
    }
  }
  return null;
}

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  
  // Dry run by default, add ?apply=true to actually write
  const apply = (event.queryStringParameters || {}).apply === 'true';
  
  try {
    // 1. Load all users
    const users = await supabaseFetch('users?select=id,name,department');
    
    // Find the 4 Account Managers by name
    const findUser = (namePart) => {
      const u = users.find(u => u.name && u.name.toLowerCase().includes(namePart.toLowerCase()));
      return u ? u.id : null;
    };
    
    const userIds = {
      dex: findUser('Dex'),
      zairen: findUser('Zairen'),
      raquel: findUser('Raquel'),
      bryan: findUser('Bryan'),
    };
    
    const userNames = {
      [userIds.dex]: 'Dex-Ann',
      [userIds.zairen]: 'Zairen',
      [userIds.raquel]: 'Raquel',
      [userIds.bryan]: 'Bryan',
    };
    
    // Verify all found
    const missing = Object.entries(userIds).filter(([k, v]) => !v);
    if (missing.length > 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: `Could not find users: ${missing.map(m => m[0]).join(', ')}`, users: users.map(u => u.name) })
      };
    }
    
    console.log('User IDs:', userIds);
    
    // 2. Load all task templates
    const tasks = await supabaseFetch('task_templates?select=id,title,assigned_to,backup_user_1,backup_user_2');
    
    // 3. Build coverage rules
    const rules = getCoverageRules(userIds);
    
    // 4. Match tasks to backups
    const amIds = new Set(Object.values(userIds));
    const changes = [];
    const noMatch = [];
    
    for (const task of tasks) {
      if (!amIds.has(task.assigned_to)) continue; // Skip non-AM tasks
      
      const amRules = rules[task.assigned_to];
      if (!amRules) continue;
      
      const backup = findBackup(task.title, amRules);
      
      if (backup) {
        const change = {
          taskId: task.id,
          taskTitle: task.title,
          assignedTo: userNames[task.assigned_to] || task.assigned_to,
          currentB1: task.backup_user_1 ? (userNames[task.backup_user_1] || task.backup_user_1) : null,
          currentB2: task.backup_user_2 ? (userNames[task.backup_user_2] || task.backup_user_2) : null,
          newB1: userNames[backup.b1] || backup.b1,
          newB2: backup.b2 ? (userNames[backup.b2] || backup.b2) : null,
          b1Id: backup.b1,
          b2Id: backup.b2 || null,
        };
        changes.push(change);
      } else {
        noMatch.push({
          taskId: task.id,
          taskTitle: task.title,
          assignedTo: userNames[task.assigned_to] || task.assigned_to,
        });
      }
    }
    
    // 5. Apply changes if requested
    const applied = [];
    if (apply) {
      for (const change of changes) {
        const updateData = { backup_user_1: change.b1Id };
        if (change.b2Id) updateData.backup_user_2 = change.b2Id;
        
        await supabasePatch('task_templates', `id=eq.${change.taskId}`, updateData);
        applied.push(`${change.assignedTo}'s "${change.taskTitle}" → B1: ${change.newB1}${change.newB2 ? `, B2: ${change.newB2}` : ''}`);
      }
    }
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        mode: apply ? 'APPLIED' : 'DRY RUN (add ?apply=true to write)',
        userIds,
        totalAmTasks: changes.length + noMatch.length,
        matchedTasks: changes.length,
        unmatchedTasks: noMatch.length,
        changes: changes.map(c => ({
          task: `${c.assignedTo}'s "${c.taskTitle}"`,
          current: `B1: ${c.currentB1 || 'none'}, B2: ${c.currentB2 || 'none'}`,
          new: `B1: ${c.newB1}${c.newB2 ? `, B2: ${c.newB2}` : ''}`,
        })),
        noMatch: noMatch.map(n => `${n.assignedTo}'s "${n.taskTitle}"`),
        applied: apply ? applied : [],
      }, null, 2)
    };
    
  } catch (error) {
    console.error('Error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};
