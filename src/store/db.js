const fs = require('fs');
const path = require('path');
const { paths } = require('../config');

// lowdb v7 is ESM-only; dynamic import keeps this module usable from the
// CommonJS runner/CLI while still working from the Next.js dashboard.
//
// The runner (a separate child process) and the dashboard server are two
// independent processes touching the same JSON file, so every call re-reads
// from disk before returning data - otherwise the dashboard's long-lived
// process would keep serving whatever it first loaded and never see writes
// made by a runner run. This is a local, low-traffic personal tool, so the
// extra file read per call is cheap and simplicity wins over adding a lock.
let dbInstance = null;

async function getDb() {
  if (!dbInstance) {
    const { Low } = await import('lowdb');
    const { JSONFile } = await import('lowdb/node');
    fs.mkdirSync(path.dirname(paths.db), { recursive: true });
    dbInstance = new Low(new JSONFile(paths.db), { jobs: {}, runs: [] });
  }
  await dbInstance.read();
  dbInstance.data ||= { jobs: {}, runs: [] };
  dbInstance.data.jobs ||= {};
  dbInstance.data.runs ||= [];
  return dbInstance;
}

function now() {
  return new Date().toISOString();
}

// Adds a newly-found match as "pending" unless the job id already exists -
// a re-scrape must never silently overwrite a status a human (or a prior
// apply attempt) already set.
async function upsertPendingJob(job, scoreInfo, runId) {
  const db = await getDb();
  if (db.data.jobs[job.jobId]) return false;

  db.data.jobs[job.jobId] = {
    id: job.jobId,
    url: job.url,
    role: job.title,
    company: job.company,
    location: job.location,
    experience: job.experience,
    salary: job.salary || null,
    skills: job.skills,
    postedDay: job.postedDay,
    match_score: scoreInfo.score,
    matchedMustHave: scoreInfo.matchedMustHave,
    matchedNiceToHave: scoreInfo.matchedNiceToHave,
    status: 'pending',
    reason: null,
    response_snapshot: null,
    screenshot_path: null,
    found_in_run: runId || null,
    applied_in_run: null,
    created_at: now(),
    updated_at: now(),
  };
  await db.write();
  return true;
}

async function getJob(id) {
  const db = await getDb();
  return db.data.jobs[id] || null;
}

async function listJobs(filter) {
  const db = await getDb();
  const all = Object.values(db.data.jobs);
  const filtered = filter ? all.filter(filter) : all;
  return filtered.sort((a, b) => (b.match_score || 0) - (a.match_score || 0));
}

async function updateJob(id, patch) {
  const db = await getDb();
  const job = db.data.jobs[id];
  if (!job) return null;
  Object.assign(job, patch, { updated_at: now() });
  await db.write();
  return job;
}

async function setStatus(id, status, extra = {}) {
  return updateJob(id, { status, ...extra });
}

// Only one run/recheck process exists at a time (the dashboard enforces it),
// so anything still marked in-progress at startup was left behind by a run
// that was stopped or crashed: close those runs and put interrupted jobs
// back in the approved queue instead of leaving them stuck on "applying".
function recoverInterrupted(db) {
  for (const run of db.data.runs) {
    if (!run.finishedAt) {
      run.finishedAt = now();
      run.counts = { ...run.counts, error: 'interrupted (stopped or crashed before finishing)' };
    }
  }
  for (const job of Object.values(db.data.jobs)) {
    if (job.status === 'applying') {
      Object.assign(job, { status: 'approved', reason: 'previous apply attempt was interrupted - retrying', updated_at: now() });
    }
  }
}

async function startRun(meta = {}) {
  const db = await getDb();
  recoverInterrupted(db);
  const run = {
    id: `run-${Date.now()}`,
    startedAt: now(),
    finishedAt: null,
    counts: {},
    totalScanned: 0,
    ...meta,
  };
  db.data.runs.push(run);
  await db.write();
  return run.id;
}

async function finishRun(runId, counts) {
  const db = await getDb();
  const run = db.data.runs.find((r) => r.id === runId);
  if (!run) return;
  run.finishedAt = now();
  run.counts = counts;
  await db.write();
}

async function listRuns() {
  const db = await getDb();
  return [...db.data.runs].reverse();
}

module.exports = {
  getDb,
  upsertPendingJob,
  getJob,
  listJobs,
  updateJob,
  setStatus,
  startRun,
  finishRun,
  listRuns,
};
