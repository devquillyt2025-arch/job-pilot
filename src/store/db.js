const { Pool } = require('pg');
require('../config'); // loads .env (DATABASE_URL)

// Neon Postgres store. The runner (a separate child process) and the dashboard
// server are two independent processes, so both talk to the database directly
// and every read is fresh - no in-process cache to go stale.
//
// Jobs and runs are kept as JSONB documents keyed by id rather than one column
// per field: the job record picks up ad-hoc fields over its life (question,
// resolvedAt, response_snapshot, ...) and the rest of the code treats it as a
// plain object, exactly as it did with the old JSON file. `updateJob` is a
// single `data || patch` UPDATE, so concurrent writers can't lose each other's
// fields the way a read-modify-write of the whole file could.
let pool = null;
let ready = null;

function getPool() {
  if (pool) return pool;
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set - add your Neon connection string to .env');
  }
  // TLS is configured here instead of via the URL's sslmode/channel_binding
  // params: pg warns about how it interprets sslmode, and that warning would
  // land in the dashboard's live log as an "error" on every run.
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.delete('sslmode');
  url.searchParams.delete('channel_binding');
  pool = new Pool({ connectionString: url.toString(), ssl: { rejectUnauthorized: true }, max: 5 });
  // An idle client dropped by Neon (e.g. compute suspended) must not crash the process.
  pool.on('error', (err) => console.error('[db] idle client error:', err.message));
  return pool;
}

async function query(text, params) {
  if (!ready) {
    ready = getPool().query(`
      CREATE TABLE IF NOT EXISTS jobs (
        id   text PRIMARY KEY,
        data jsonb NOT NULL
      );
      CREATE TABLE IF NOT EXISTS runs (
        id         text PRIMARY KEY,
        started_at timestamptz NOT NULL,
        data       jsonb NOT NULL
      );
    `).catch((err) => {
      ready = null; // let the next call retry instead of caching the failure
      throw err;
    });
  }
  await ready;
  return getPool().query(text, params);
}

function now() {
  return new Date().toISOString();
}

// Adds a newly-found match as "pending" unless the job id already exists -
// a re-scrape must never silently overwrite a status a human (or a prior
// apply attempt) already set.
async function upsertPendingJob(job, scoreInfo, runId) {
  const record = {
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
  const { rowCount } = await query(
    'INSERT INTO jobs (id, data) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING',
    [record.id, record]
  );
  return rowCount > 0;
}

/** Inserts a fully-formed job record as-is; false if the id already exists. Used by imports. */
async function insertJob(record) {
  const { rowCount } = await query(
    'INSERT INTO jobs (id, data) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING',
    [record.id, record]
  );
  return rowCount > 0;
}

async function getJob(id) {
  const { rows } = await query('SELECT data FROM jobs WHERE id = $1', [id]);
  return rows[0] ? rows[0].data : null;
}

async function listJobs(filter) {
  const { rows } = await query('SELECT data FROM jobs');
  const all = rows.map((r) => r.data);
  const filtered = filter ? all.filter(filter) : all;
  return filtered.sort((a, b) => (b.match_score || 0) - (a.match_score || 0));
}

async function updateJob(id, patch) {
  const { rows } = await query(
    'UPDATE jobs SET data = data || $2::jsonb WHERE id = $1 RETURNING data',
    [id, { ...patch, updated_at: now() }]
  );
  return rows[0] ? rows[0].data : null;
}

async function setStatus(id, status, extra = {}) {
  return updateJob(id, { status, ...extra });
}

// Only one run/recheck process exists at a time (the dashboard enforces it),
// so anything still marked in-progress at startup was left behind by a run
// that was stopped or crashed: close those runs and put interrupted jobs
// back in the approved queue instead of leaving them stuck on "applying".
async function recoverInterrupted() {
  const ts = now();
  await query(
    `UPDATE runs
        SET data = data || jsonb_build_object(
          'finishedAt', $1::text,
          'counts', COALESCE(data->'counts', '{}'::jsonb) || '{"error": "interrupted (stopped or crashed before finishing)"}'::jsonb)
      WHERE data->>'finishedAt' IS NULL`,
    [ts]
  );
  await query(
    `UPDATE jobs
        SET data = data || jsonb_build_object(
          'status', 'approved',
          'reason', 'previous apply attempt was interrupted - retrying',
          'updated_at', $1::text)
      WHERE data->>'status' = 'applying'`,
    [ts]
  );
}

async function startRun(meta = {}) {
  await recoverInterrupted();
  const run = {
    id: `run-${Date.now()}`,
    startedAt: now(),
    finishedAt: null,
    counts: {},
    totalScanned: 0,
    ...meta,
  };
  await query('INSERT INTO runs (id, started_at, data) VALUES ($1, $2, $3)', [run.id, run.startedAt, run]);
  return run.id;
}

async function finishRun(runId, counts) {
  await query(
    `UPDATE runs SET data = data || jsonb_build_object('finishedAt', $2::text, 'counts', $3::jsonb) WHERE id = $1`,
    [runId, now(), counts || {}]
  );
}

/** Inserts a fully-formed run record as-is; false if the id already exists. Used by imports. */
async function insertRun(run) {
  const { rowCount } = await query(
    'INSERT INTO runs (id, started_at, data) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
    [run.id, run.startedAt, run]
  );
  return rowCount > 0;
}

/** Newest first. */
async function listRuns() {
  const { rows } = await query('SELECT data FROM runs ORDER BY started_at DESC');
  return rows.map((r) => r.data);
}

/** Lets one-shot scripts exit promptly instead of waiting on idle connections. */
async function close() {
  if (pool) await pool.end();
  pool = null;
  ready = null;
}

module.exports = {
  upsertPendingJob,
  insertJob,
  getJob,
  listJobs,
  updateJob,
  setStatus,
  startRun,
  finishRun,
  insertRun,
  listRuns,
  close,
};
