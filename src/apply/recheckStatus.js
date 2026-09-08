const { loadSelectors } = require('../config');
const { classifyApplyAffordance } = require('./classify');
const { captureDiagnostic } = require('./capture');

// Read-only revisit of a job's detail page - never clicks anything. Naukri
// itself is the source of truth for "did this actually go through": once
// applied (by the bot OR by hand), the Apply button is permanently replaced
// with static "Applied" text, so the same classifier used before applying
// works just as well after the fact.
async function recheckJobStatus(page, job) {
  const selectors = loadSelectors();

  await page.goto(job.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  const classification = await classifyApplyAffordance(page, selectors.detail);

  if (classification.kind === 'already_applied') {
    return { outcome: 'applied', reason: 'confirmed applied on recheck (page shows "Applied", no apply button)' };
  }
  if (classification.kind === 'external') {
    return { outcome: 'skipped_external', reason: 'confirmed external application ("Apply on company site") on recheck' };
  }
  if (classification.kind === 'naukri') {
    return { outcome: 'not_applied', reason: 'still shows an active "Apply" button - not applied yet' };
  }

  const capture = await captureDiagnostic(page, job, 'recheck: no known apply affordance found');
  return { outcome: 'inconclusive', ...capture };
}

module.exports = { recheckJobStatus };
