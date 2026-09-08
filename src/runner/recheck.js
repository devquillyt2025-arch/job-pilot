const { launchContext, saveSession } = require('../browser');
const { ensureLoggedIn } = require('../auth/ensureLoggedIn');
const { recheckJobStatus } = require('../apply/recheckStatus');
const { listJobs, getJob, updateJob, setStatus } = require('../store/db');
const { settings } = require('../config');
const { randomDelay } = require('../util/delay');

// One JSON object per stdout line, same convention as runner/run.js - the
// dashboard's custom server parses each line and rebroadcasts it over
// WebSocket.
function emit(event) {
  process.stdout.write(JSON.stringify(event) + '\n');
}

// Jobs in these statuses are already confirmed by a live revisit (applied /
// skipped_external) or are a deliberate human call (rejected) - nothing left
// to verify. Everything else (pending, approved, applying, needs_review,
// failed) is worth a read-only look, since any of them could turn out to
// have been applied to by hand outside the bot.
const TERMINAL_STATUSES = new Set(['applied', 'rejected', 'skipped_external']);

function parseArgs() {
  const idsArg = process.argv.find((a) => a.startsWith('--ids='));
  const ids = idsArg
    ? idsArg
        .slice('--ids='.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : null;
  return { ids };
}

async function pickTargets(ids) {
  if (ids && ids.length) {
    const jobs = [];
    for (const id of ids) {
      const job = await getJob(id);
      if (job) jobs.push(job);
    }
    return jobs;
  }
  return listJobs((j) => !TERMINAL_STATUSES.has(j.status));
}

(async () => {
  const { ids } = parseArgs();
  const counts = { applied: 0, skipped_external: 0, unchanged: 0, inconclusive: 0, failed: 0 };
  let browser;

  try {
    const targets = await pickTargets(ids);
    emit({ type: 'phase', phase: 'recheck', total: targets.length });

    const launched = await launchContext({ visible: false });
    browser = launched.browser;
    const { context } = launched;
    const page = await context.newPage();

    await ensureLoggedIn(page);
    await saveSession(context);

    for (let i = 0; i < targets.length; i++) {
      const job = targets[i];
      emit({ type: 'recheck_progress', index: i + 1, total: targets.length, job });

      let result;
      try {
        result = await recheckJobStatus(page, job);
      } catch (err) {
        result = { outcome: 'failed', reason: err.message };
      }

      let updated = job;
      const checkedAt = new Date().toISOString();

      if (result.outcome === 'applied' || result.outcome === 'skipped_external') {
        updated = await setStatus(job.id, result.outcome, {
          reason: result.reason,
          screenshot_path: result.screenshot_path || null,
          html_path: result.html_path || null,
          verified_at: checkedAt,
        });
        counts[result.outcome]++;
      } else if (result.outcome === 'not_applied') {
        updated = await updateJob(job.id, { last_checked_at: checkedAt });
        counts.unchanged++;
      } else if (result.outcome === 'inconclusive') {
        updated = await updateJob(job.id, {
          last_checked_at: checkedAt,
          screenshot_path: result.screenshot_path,
          html_path: result.html_path,
        });
        counts.inconclusive++;
      } else {
        counts.failed++;
      }

      emit({ type: 'recheck_result', job: updated, outcome: result.outcome, reason: result.reason });

      if (i < targets.length - 1) {
        await randomDelay(settings.minActionDelayMs, settings.maxActionDelayMs);
      }
    }

    emit({ type: 'recheck_finished', counts });
  } catch (err) {
    emit({ type: 'error', message: err.message });
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
  }
})();
