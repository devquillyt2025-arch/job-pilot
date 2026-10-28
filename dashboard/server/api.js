const fs = require('fs');
const path = require('path');

const rootSrc = path.join(__dirname, '..', '..', 'src');
const { listJobs, getJob, updateJob, setStatus, listRuns } = require(path.join(rootSrc, 'store', 'db.js'));
const { paths, loadSelectors, loadQaBank } = require(path.join(rootSrc, 'config.js'));

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function slugify(text) {
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function setNestedPath(obj, dotted, value) {
  const parts = dotted.split('.');
  let node = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof node[parts[i]] !== 'object' || node[parts[i]] === null) node[parts[i]] = {};
    node = node[parts[i]];
  }
  node[parts[parts.length - 1]] = value;
}

async function listJobsHandler(req, res, query) {
  const statusFilter = query.get('status');
  const runIdFilter = query.get('run_id');
  const jobs = await listJobs((j) => {
    if (statusFilter && j.status !== statusFilter) return false;
    if (runIdFilter && j.found_in_run !== runIdFilter && j.applied_in_run !== runIdFilter) return false;
    return true;
  });
  sendJson(res, 200, jobs);
}

// Screenshots/HTML captured under data/logs and data/selector-misses are
// served read-only by basename, constrained to those two directories, so
// the dashboard can show them without exposing the filesystem generally.
async function screenshotHandler(req, res, query) {
  const file = query.get('file');
  if (!file || file.includes('..') || path.isAbsolute(file)) {
    return sendJson(res, 400, { error: 'invalid file' });
  }
  for (const dir of [paths.selectorMisses, paths.logs]) {
    const full = path.join(dir, file);
    if (fs.existsSync(full)) {
      const ext = path.extname(full).toLowerCase();
      const contentType = ext === '.html' ? 'text/html' : ext === '.png' ? 'image/png' : 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      return fs.createReadStream(full).pipe(res);
    }
  }
  sendJson(res, 404, { error: 'not found' });
}

async function patchJobHandler(req, res, id) {
  const body = await readBody(req);
  if (!body.status) return sendJson(res, 400, { error: 'status is required' });
  const job = await setStatus(id, body.status);
  if (!job) return sendJson(res, 404, { error: 'job not found' });
  sendJson(res, 200, job);
}

// Answer written back into qa-bank.json - the bank grows with use. The job
// is bounced back to "approved" so the next Run retries it with the new
// answer, rather than needing a separate per-job retry mechanism.
async function resolveQuestionHandler(req, res, id) {
  const body = await readBody(req);
  const job = await getJob(id);
  if (!job) return sendJson(res, 404, { error: 'job not found' });
  if (!job.question) return sendJson(res, 400, { error: 'this job has no captured question to resolve' });
  if (!body.answer) return sendJson(res, 400, { error: 'answer is required' });

  const qaBank = loadQaBank();
  const Fuse = (await import('fuse.js')).default;
  const fuse = new Fuse(qaBank.entries, { keys: ['question'], threshold: 0.3 });
  const [existing] = fuse.search(job.question);

  if (existing) {
    existing.item.answer = body.answer;
  } else {
    qaBank.entries.push({ id: slugify(job.question) || `q-${Date.now()}`, question: job.question, answer: body.answer });
  }
  fs.writeFileSync(paths.qaBankFile, JSON.stringify(qaBank, null, 2));

  const updated = await setStatus(id, 'approved', { resolvedAt: new Date().toISOString() });
  sendJson(res, 200, updated);
}

// Patches config/selectors.json at a dot-path (e.g. "chatbot.questionText")
// from the dashboard, using the HTML/screenshot captured for this job to
// figure out the right selector - no code change or redeploy needed.
async function resolveSelectorHandler(req, res, id) {
  const body = await readBody(req);
  if (!body.path || !body.value) return sendJson(res, 400, { error: 'path and value are required' });

  const selectors = loadSelectors();
  setNestedPath(selectors, body.path, body.value);
  fs.writeFileSync(paths.selectorsFile, JSON.stringify(selectors, null, 2));

  const updated = await setStatus(id, 'approved', { resolvedAt: new Date().toISOString() });
  sendJson(res, 200, updated);
}

async function getQaBankHandler(req, res) {
  sendJson(res, 200, loadQaBank());
}

async function putQaBankHandler(req, res) {
  const body = await readBody(req);
  fs.writeFileSync(paths.qaBankFile, JSON.stringify(body, null, 2));
  sendJson(res, 200, body);
}

async function getSelectorsHandler(req, res) {
  sendJson(res, 200, loadSelectors());
}

async function getProfileHandler(req, res) {
  // Read fresh from disk (not the cached require) so edits show without a restart.
  const file = path.join(__dirname, '..', '..', 'config', 'profile.json');
  sendJson(res, 200, JSON.parse(fs.readFileSync(file, 'utf8')));
}

async function putSelectorsHandler(req, res) {
  const body = await readBody(req);
  fs.writeFileSync(paths.selectorsFile, JSON.stringify(body, null, 2));
  sendJson(res, 200, body);
}

async function listRunsHandler(req, res) {
  sendJson(res, 200, await listRuns());
}

async function statsHandler(req, res) {
  const jobs = await listJobs();
  const byStatus = {};
  for (const job of jobs) byStatus[job.status] = (byStatus[job.status] || 0) + 1;

  const runs = await listRuns();
  const trend = runs
    .filter((r) => r.finishedAt && r.counts && r.counts.apply)
    .map((r) => ({
      runId: r.id,
      finishedAt: r.finishedAt,
      applied: r.counts.apply.applied || 0,
      skipped_external: r.counts.apply.skipped_external || 0,
      needs_review: r.counts.apply.needs_review || 0,
      failed: r.counts.apply.failed || 0,
    }));

  sendJson(res, 200, { byStatus, totalJobs: jobs.length, trend });
}

const routes = [
  { method: 'GET', pattern: /^\/api\/jobs$/, handler: (req, res, m, q) => listJobsHandler(req, res, q) },
  { method: 'PATCH', pattern: /^\/api\/jobs\/([^/]+)$/, handler: (req, res, m) => patchJobHandler(req, res, m[1]) },
  { method: 'POST', pattern: /^\/api\/jobs\/([^/]+)\/resolve-question$/, handler: (req, res, m) => resolveQuestionHandler(req, res, m[1]) },
  { method: 'POST', pattern: /^\/api\/jobs\/([^/]+)\/resolve-selector$/, handler: (req, res, m) => resolveSelectorHandler(req, res, m[1]) },
  { method: 'GET', pattern: /^\/api\/qa-bank$/, handler: (req, res) => getQaBankHandler(req, res) },
  { method: 'PUT', pattern: /^\/api\/qa-bank$/, handler: (req, res) => putQaBankHandler(req, res) },
  { method: 'GET', pattern: /^\/api\/selectors$/, handler: (req, res) => getSelectorsHandler(req, res) },
  { method: 'PUT', pattern: /^\/api\/selectors$/, handler: (req, res) => putSelectorsHandler(req, res) },
  { method: 'GET', pattern: /^\/api\/profile$/, handler: (req, res) => getProfileHandler(req, res) },
  { method: 'GET', pattern: /^\/api\/runs$/, handler: (req, res) => listRunsHandler(req, res) },
  { method: 'GET', pattern: /^\/api\/stats$/, handler: (req, res) => statsHandler(req, res) },
  { method: 'GET', pattern: /^\/api\/capture$/, handler: (req, res, m, q) => screenshotHandler(req, res, q) },
];

// Returns true if this request was handled (caller should not fall through
// to Next.js), false otherwise.
async function handleApi(req, res) {
  const url = new URL(req.url, 'http://localhost');
  for (const route of routes) {
    if (route.method !== req.method) continue;
    const match = url.pathname.match(route.pattern);
    if (!match) continue;
    try {
      await route.handler(req, res, match, url.searchParams);
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return true;
  }
  return false;
}

module.exports = { handleApi };
