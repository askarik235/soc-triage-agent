// SOC Triage Assistant - Hardened Backend
require('dotenv').config();

const http = require('http');
const url = require('url');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3001;
const NAPSTER_API_KEY = process.env.NAPSTER_API_KEY;
const AGENT_ID = process.env.AGENT_ID;
const TOOL_SECRET = process.env.TOOL_SECRET;
const CLIENT_KEY = process.env.CLIENT_KEY;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:5174').split(',').map(s => s.trim());
const API_BASE = 'https://companion-api.napster.com/public';
const DATA_FILE = path.join(__dirname, 'tickets.json');

const missing = [];
if (!NAPSTER_API_KEY) missing.push('NAPSTER_API_KEY');
if (!AGENT_ID) missing.push('AGENT_ID');
if (!TOOL_SECRET) missing.push('TOOL_SECRET');
if (!CLIENT_KEY) missing.push('CLIENT_KEY');
if (missing.length) { console.error('[FATAL] Missing required env vars: ' + missing.join(', ') + '. Set them in your .env file.'); process.exit(1); }

const tickets = new Map();
function loadTickets() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      for (const t of raw) tickets.set(t.id, t);
      console.log('  Loaded ' + tickets.size + ' tickets from disk.');
    }
  } catch (e) { console.error('[WARN] Could not load tickets file:', e.message); }
}
function saveTickets() {
  try { fs.writeFileSync(DATA_FILE, JSON.stringify(Array.from(tickets.values()), null, 2)); }
  catch (e) { console.error('[WARN] Could not save tickets:', e.message); }
}

function generateTicketId() { return 'SOC-' + crypto.randomInt(10000, 99999); }

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-tool-secret, x-client-key',
  };
}
function json(res, status, data, origin) {
  res.writeHead(status, Object.assign({ 'Content-Type': 'application/json' }, corsHeaders(origin)));
  res.end(JSON.stringify(data));
}
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let b = '', size = 0;
    req.on('data', c => { size += c.length; if (size > 100000) { reject(new Error('Body too large')); req.destroy(); } b += c; });
    req.on('end', () => { try { resolve(b ? JSON.parse(b) : {}); } catch { reject(new Error('Invalid JSON')); } });
    req.on('error', reject);
  });
}

function checkToolSecret(req) { return req.headers['x-tool-secret'] === TOOL_SECRET; }
function checkClientKey(req) { return req.headers['x-client-key'] === CLIENT_KEY; }

const buckets = new Map();
function rateLimit(ip, max, windowMs) {
  const now = Date.now();
  let b = buckets.get(ip);
  if (!b || now > b.reset) { b = { count: 0, reset: now + windowMs }; buckets.set(ip, b); }
  b.count++;
  return b.count <= max;
}
setInterval(() => { const now = Date.now(); for (const [k, v] of buckets) if (now > v.reset) buckets.delete(k); }, 60000);

function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  return (xf ? xf.split(',')[0].trim() : req.socket.remoteAddress) || 'unknown';
}

function vstr(v, n) { if (!v || typeof v !== 'string') throw new Error('VALIDATION:' + n); return v.trim().slice(0, 1000); }
function vid(v) {
  if (typeof v !== 'string') return 'analyst-001';
  const clean = v.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32);
  return clean.length ? clean : 'analyst-001';
}

function calcPriority(impact, ongoing, type) { if (impact === 'critical' || (impact === 'high' && ongoing)) return 'P1'; if (impact === 'high' || (impact === 'medium' && ongoing)) return 'P2'; if (['ransomware','data breach','apt','zero-day'].some(t => type.toLowerCase().includes(t))) return 'P2'; if (impact === 'medium') return 'P3'; return 'P4'; }
function slaText(p) { return { P1:'15 minutes', P2:'1 hour', P3:'4 hours', P4:'24 hours' }[p]; }
function slaDeadline(p) { const m = { P1:15, P2:60, P3:240, P4:1440 }[p] || 1440; const d = new Date(); d.setMinutes(d.getMinutes() + m); return d.toISOString(); }

function learnedNote(type, priority) {
  const t = type.toLowerCase();
  if (t.includes('ransomware')) return 'Ransomware on endpoints - isolate fast, verify backups before any recovery.';
  if (t.includes('phish')) return 'Phishing vector - reset exposed credentials and enforce MFA on affected accounts.';
  if (t.includes('unauthorized') || t.includes('login') || t.includes('access')) return 'Unauthorized access - revoke sessions immediately and audit for lateral movement.';
  if (t.includes('data') || t.includes('exfil') || t.includes('breach')) return 'Data exposure - preserve logs early; breach notification may be legally required.';
  if (t.includes('ddos') || t.includes('denial')) return 'DDoS pattern - engage scrubbing and watch for it masking a second attack.';
  if (t.includes('malware')) return 'Malware detected - image the host before cleanup to preserve evidence.';
  return priority === 'P1' || priority === 'P2' ? 'High-severity event - containment first, full scope second.' : 'Lower-severity event - logged and monitored through the queue.';
}

function buildActionPlan(type, priority) {
  const t = type.toLowerCase();
  let plan = { containment: [], investigation: [], recovery: [], notify: [] };
  if (t.includes('ransomware')) {
    plan.containment = ['Isolate affected devices from the network immediately', 'Disable affected user accounts', 'Block known malicious IPs at the firewall', 'Preserve a forensic image before any cleanup'];
    plan.investigation = ['Identify the ransomware variant from ransom note or file extensions', 'Determine initial access vector (phishing, RDP, exploit)', 'Map the full scope of encrypted systems', 'Check backups for integrity and recency'];
    plan.recovery = ['Restore from clean backups after confirming eradication', 'Reset credentials for all affected accounts', 'Patch the exploited vulnerability', 'Monitor for re-infection for 14 days'];
    plan.notify = ['CISO', 'Legal/Compliance (potential breach notification)', 'On-Call IR team'];
  } else if (t.includes('phish')) {
    plan.containment = ['Quarantine the phishing email across all mailboxes', 'Block the sender domain and any malicious URLs', 'Reset credentials for anyone who clicked or entered data', 'Revoke active sessions for affected accounts'];
    plan.investigation = ['Identify all recipients of the phishing email', 'Check for credential entry on the phishing page', 'Review login logs for suspicious access from new locations', 'Determine if any malware payload was delivered'];
    plan.recovery = ['Enforce MFA on affected accounts', 'Run security-awareness reminder to staff', 'Add indicators to email filtering rules'];
    plan.notify = ['SOC team lead', 'Affected department managers'];
  } else if (t.includes('unauthorized') || t.includes('login') || t.includes('access')) {
    plan.containment = ['Disable the compromised account immediately', 'Revoke all active sessions and tokens', 'Block the source IP if external', 'Enable enhanced logging on affected systems'];
    plan.investigation = ['Review authentication logs for the access timeline', 'Determine what data or systems were accessed', 'Check for privilege escalation or lateral movement', 'Identify how credentials were obtained'];
    plan.recovery = ['Reset credentials and enforce MFA', 'Review and tighten access permissions', 'Audit for any backdoors or persistence'];
    plan.notify = ['SOC team lead', 'System/data owner'];
  } else if (t.includes('ddos') || t.includes('denial')) {
    plan.containment = ['Enable DDoS mitigation / rate limiting', 'Route traffic through a scrubbing service', 'Block offending IP ranges', 'Scale infrastructure if needed to absorb load'];
    plan.investigation = ['Identify attack vector and traffic pattern', 'Determine if it is a smokescreen for another attack', 'Assess impact on availability'];
    plan.recovery = ['Gradually restore normal routing', 'Document attack signature for future blocking', 'Review capacity and resilience'];
    plan.notify = ['Network operations', 'SOC team lead'];
  } else {
    plan.containment = ['Isolate affected systems to limit blast radius', 'Preserve logs and evidence', 'Restrict access to affected resources'];
    plan.investigation = ['Establish the timeline of events', 'Identify affected systems and data', 'Determine root cause from available evidence'];
    plan.recovery = ['Remediate the root cause', 'Restore affected services', 'Monitor for recurrence'];
    plan.notify = ['SOC team lead'];
  }
  const urgency = priority === 'P1' ? 'Execute containment IMMEDIATELY in parallel, not sequentially.' : priority === 'P2' ? 'Begin containment within the hour.' : 'Proceed methodically through each phase.';
  return { priority, urgency_note: urgency, action_plan: plan, requires_human_approval: ['P1','P2'].includes(priority) ? 'Containment actions that disrupt production require analyst sign-off before execution.' : 'Standard actions; document as you go.' };
}
async function handleClassify(b) { const a = b.arguments || b; const type = vstr(a.incident_type, 'incident_type'); const sys = vstr(a.affected_systems, 'affected_systems'); const impact = a.business_impact || 'medium'; const ongoing = Boolean(a.is_ongoing); const priority = calcPriority(impact, ongoing, type); return { priority, sla: 'Response required within ' + slaText(priority), incident_type: type, affected_systems: sys, timestamp: new Date().toISOString() }; }
async function handlePlan(b) { const a = b.arguments || b; const type = vstr(a.incident_type, 'incident_type'); const priority = a.priority || 'P3'; return buildActionPlan(type, priority); }
async function handleTicket(b) { const a = b.arguments || b; const priority = vstr(a.priority, 'priority'); const type = vstr(a.incident_type, 'incident_type'); const summary = vstr(a.summary, 'summary'); const sys = vstr(a.affected_systems, 'affected_systems'); const id = generateTicketId(); const ticket = { id, status: 'OPEN', priority, incident_type: type, summary, affected_systems: sys, timeline: a.timeline || 'Not specified', actions_taken: a.actions_taken || 'None', learned: learnedNote(type, priority), recovery_plan: buildActionPlan(type, priority).action_plan, analyst: vid(a.analyst), created_at: new Date().toISOString(), sla_deadline: slaDeadline(priority), assigned_to: 'SOC Queue' }; tickets.set(id, ticket); saveTickets(); console.log('[TICKET] ' + id + ' (' + priority + '): ' + summary); return { ticket_id: id, priority, status: 'OPEN', sla_deadline: ticket.sla_deadline, message: 'Ticket ' + id + ' created.' }; }
async function handleEscalate(b) { const a = b.arguments || b; const id = vstr(a.ticket_id, 'ticket_id'); const priority = vstr(a.priority, 'priority'); const reason = vstr(a.reason, 'reason'); if (!['P1','P2'].includes(priority)) throw new Error('VALIDATION:priority'); const t = tickets.get(id); if (t) { t.status = 'ESCALATED'; t.escalated_at = new Date().toISOString(); t.assigned_to = 'On-Call Analyst'; saveTickets(); } console.log('[ESCALATE] ' + id); return { escalation_id: 'ESC-' + crypto.randomInt(1000,9999), ticket_id: id, status: 'ESCALATED', assigned_to: 'On-Call Analyst', estimated_response: priority === 'P1' ? 'Within 15 minutes' : 'Within 1 hour', message: 'Escalated to on-call analyst.' }; }

async function handleSession(b) {
  const res = await fetch(API_BASE + '/agents/' + AGENT_ID + '/connections', {
    method: 'POST', headers: { 'X-Api-Key': NAPSTER_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ channelType: 'websocket', disableIdleTimeout: true, externalClientId: vid(b.userId), externalClientProfile: (b.userProfile && typeof b.userProfile === 'object') ? b.userProfile : { name: 'Analyst', role: 'SOC L1' } })
  });
  if (!res.ok) { const e = await res.text(); console.error('[NAPSTER ' + res.status + ']', e); throw new Error('UPSTREAM'); }
  return res.json();
}

const server = http.createServer(async (req, res) => {
  const { pathname } = url.parse(req.url);
  const origin = req.headers.origin || '';
  const ip = clientIp(req);

  if (req.method === 'OPTIONS') { res.writeHead(204, corsHeaders(origin)); res.end(); return; }

  if (!rateLimit('all:' + ip, 120, 60000)) { json(res, 429, { error: 'Too many requests' }, origin); return; }

  try {
    if (req.method === 'POST' && pathname === '/tools/classify') { if (!checkToolSecret(req)) return json(res, 401, { error: 'Unauthorized' }, origin); return json(res, 200, await handleClassify(await parseBody(req)), origin); }
    if (req.method === 'POST' && pathname === '/tools/action-plan') { if (!checkToolSecret(req)) return json(res, 401, { error: 'Unauthorized' }, origin); return json(res, 200, await handlePlan(await parseBody(req)), origin); }
    if (req.method === 'POST' && pathname === '/tools/create-ticket') { if (!checkToolSecret(req)) return json(res, 401, { error: 'Unauthorized' }, origin); return json(res, 200, await handleTicket(await parseBody(req)), origin); }
    if (req.method === 'POST' && pathname === '/tools/escalate') { if (!checkToolSecret(req)) return json(res, 401, { error: 'Unauthorized' }, origin); return json(res, 200, await handleEscalate(await parseBody(req)), origin); }

    if (req.method === 'POST' && pathname === '/api/session') {
      if (!checkClientKey(req)) return json(res, 401, { error: 'Unauthorized' }, origin);
      if (!rateLimit('session:' + ip, 10, 60000)) return json(res, 429, { error: 'Too many sessions, slow down' }, origin);
      return json(res, 200, await handleSession(await parseBody(req)), origin);
    }
    if (req.method === 'GET' && pathname === '/tickets') {
      if (!checkClientKey(req)) return json(res, 401, { error: 'Unauthorized' }, origin);
      return json(res, 200, { total: tickets.size, tickets: Array.from(tickets.values()).sort((a,b) => new Date(b.created_at) - new Date(a.created_at)) }, origin);
    }
    const mem = pathname.match(/^\/memory(?:\/(.+))?$/);
    if (req.method === 'GET' && mem) {
      if (!checkClientKey(req)) return json(res, 401, { error: 'Unauthorized' }, origin);
      const analyst = mem[1] ? vid(mem[1]) : null;
      let items = Array.from(tickets.values());
      if (analyst) items = items.filter(t => (t.analyst || 'analyst-001') === analyst);
      items.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
      return json(res, 200, { count: items.length, memory: items.map(t => ({ id: t.id, incident_type: t.incident_type, priority: t.priority, summary: t.summary, affected_systems: t.affected_systems, status: t.status, learned: t.learned, recovery_plan: t.recovery_plan, created_at: t.created_at })) }, origin);
    }

    if (req.method === 'GET' && pathname === '/health') { return json(res, 200, { status: 'ok' }, origin); }

    return json(res, 404, { error: 'Not found' }, origin);
  } catch (err) {
    if (typeof err.message === 'string' && err.message.startsWith('VALIDATION:')) {
      return json(res, 400, { error: 'Invalid or missing field: ' + err.message.slice(11) }, origin);
    }
    console.error('[ERROR] ' + req.method + ' ' + pathname + ':', err.message);
    return json(res, 500, { error: 'Internal server error' }, origin);
  }
});

loadTickets();
server.listen(PORT, () => {
  console.log('\n  SOC Backend (hardened) on port ' + PORT);
  console.log('  Allowed origins: ' + ALLOWED_ORIGINS.join(', '));
  console.log('  Health:  http://localhost:' + PORT + '/health');
  console.log('  (tickets & memory now require x-client-key)\n');
});