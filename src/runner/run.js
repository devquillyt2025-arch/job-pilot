const { launchContext, saveSession } = require('../browser');
const { ensureLoggedIn } = require('../auth/ensureLoggedIn');
const { searchQuery } = require('../scraper/search');
const { scoreJob } = require('../matching/scorer');
const { applyToJob } = require('../apply/applyToJob');
const { upsertPendingJob, getJob, listJobs, setStatus, startRun, finishRun, close: closeDb } = require('../store/db');
const { profile, settings } = require('../config');
const { randomDelay } = require('../util/delay');

// One JSON object per stdout line - the dashboard's custom server parses
// each line and rebroadcasts it over WebSocket. Keep stdout exclusively for
// these events; anything else (uncaught errors, etc.) goes to stderr.
function emit(event) {
  process.stdout.write(JSON.stringify(event) + '\n');
}

async function runSearchPhase(page, runId) {
  const totalQueries = profile.searchQueries.length;
  emit({ type: 'phase', phase: 'search', total: totalQueries });

  const counts = { scanned: 0, added: 0, excluded: 0, belowThreshold: 0, skipped_duplicate: 0 };
  const maxNew = settings.maxNewJobsPerSearchRun || Infinity;

  for (let queryIndex = 0; queryIndex < profile.searchQueries.length; queryIndex++) {
    const query = profile.searchQueries[queryIndex];
    if (counts.added >= maxNew) break;
    emit({
      type: 'search_query_started',
      keywords: query.keywords,
      location: query.location,
      index: queryIndex + 1,
      total: totalQueries,
    });

    const jobs = await searchQuery(page, query, {
      maxPages: profile.maxPagesPerQuery || 1,
      onPage: (n, count) => emit({ type: 'search_page', keywords: query.keywords, page: n, count }),
    });

    for (const job of jobs) {
      if (counts.added >= maxNew) break;
      if (!job.jobId || !job.url) continue;
      counts.scanned++;

      const existing = await getJob(job.jobId);
      if (existing) {
        // Same job resurfacing (repost, or overlap between search queries in
        // this run) - it already has its own real status, so this is just a
        // visible "seen again, skipping" event, never a status overwrite.
        counts.skipped_duplicate++;
        emit({ type: 'job_skipped_duplicate', jobId: job.jobId, title: job.title });
        continue;
      }

      const scoreInfo = scoreJob(job, profile);
      if (scoreInfo.excluded) {
        counts.excluded++;
        continue;
      }
      if (scoreInfo.score < (profile.minMatchScore || 0)) {
        counts.belowThreshold++;
        continue;
      }

      const wasAdded = await upsertPendingJob(job, scoreInfo, runId);
      if (wasAdded) {
        counts.added++;
        emit({ type: 'job_found', job: await getJob(job.jobId) });
      }
    }

    await randomDelay(settings.minActionDelayMs, settings.maxActionDelayMs);
  }

  emit({ type: 'search_finished', ...counts });
  return counts;
}

async function runApplyPhase(context, page, runId) {
  const approved = await listJobs((j) => j.status === 'approved');
  const cap = settings.maxApplicationsPerRun || approved.length;
  const batch = approved.slice(0, cap);

  emit({ type: 'phase', phase: 'apply', total: batch.length });

  const counts = { applied: 0, skipped_external: 0, needs_review: 0, failed: 0 };

  for (let i = 0; i < batch.length; i++) {
    const job = batch[i];
    await setStatus(job.id, 'applying');
    emit({ type: 'job_progress', index: i + 1, total: batch.length, job });

    let result;
    try {
      result = await applyToJob(context, page, job);
    } catch (err) {
      result = { outcome: 'failed', reason: err.message };
    }

    counts[result.outcome] = (counts[result.outcome] || 0) + 1;

    const updated = await setStatus(job.id, result.outcome, {
      subtype: result.subtype || null,
      reason: result.reason || null,
      question: result.question || null,
      externalUrl: result.externalUrl || null,
      response_snapshot: result.response_snapshot || null,
      screenshot_path: result.screenshot_path || null,
      html_path: result.html_path || null,
      applied_in_run: runId,
    });
    emit({ type: 'job_result', job: updated });

    if (i < batch.length - 1) {
      await randomDelay(settings.minApplyDelayMs, settings.maxApplyDelayMs);
    }
  }

  emit({ type: 'apply_finished', counts });
  return counts;
}

(async () => {
  let runId;
  try {
    runId = await startRun();
  } catch (err) {
    // Database unreachable (bad DATABASE_URL, Neon down, offline) - report it
    // as a normal error event instead of an unhandled-rejection stack trace.
    emit({ type: 'error', message: `database: ${err.message}` });
    process.exitCode = 1;
    await closeDb().catch(() => {});
    return;
  }
  emit({ type: 'run_started', runId });

  let browser;
  try {
    const launched = await launchContext({ visible: false });
    browser = launched.browser;
    const { context } = launched;
    const page = await context.newPage();

    await ensureLoggedIn(page);
    await saveSession(context);

    const search = await runSearchPhase(page, runId);
    const apply = await runApplyPhase(context, page, runId);

    await finishRun(runId, { search, apply });
    emit({ type: 'run_finished', runId, search, apply });
  } catch (err) {
    emit({ type: 'error', message: err.message });
    // If the error *was* the database, recording it fails too - don't let that
    // escape as an unhandled rejection.
    await finishRun(runId, { error: err.message }).catch(() => {});
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    // The pg pool keeps the event loop alive; the dashboard waits for this
    // process to exit to know the run is over.
    await closeDb();
  }
})();
