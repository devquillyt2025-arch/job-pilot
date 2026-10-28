// One-time copy of the pre-Neon JSON store (data/autojob.json) into Postgres.
// Safe to re-run: ids already in the database are left untouched, so nothing
// set since the import (statuses, answers) gets overwritten.
const fs = require('fs');
const { paths } = require('../config');
const { insertJob, insertRun, close } = require('./db');

async function importJson() {
  if (!fs.existsSync(paths.db)) {
    console.log(`No ${paths.db} found - nothing to import.`);
    return;
  }
  const data = JSON.parse(fs.readFileSync(paths.db, 'utf8'));
  const jobs = Object.values(data.jobs || {});
  const runs = data.runs || [];

  let jobsAdded = 0;
  for (const job of jobs) if (await insertJob(job)) jobsAdded++;
  let runsAdded = 0;
  for (const run of runs) if (await insertRun(run)) runsAdded++;

  console.log(`Imported ${jobsAdded}/${jobs.length} job(s) and ${runsAdded}/${runs.length} run(s); the rest were already in the database.`);
}

importJson()
  .catch((err) => {
    console.error('Import failed:', err.message);
    process.exitCode = 1;
  })
  .finally(close);
