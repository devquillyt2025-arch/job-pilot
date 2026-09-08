const { loadSelectors } = require('../config');
const { classifyApplyAffordance, checkAppliedSuccess } = require('./classify');
const { resolveChatbot } = require('./chatbotResolver');
const { captureDiagnostic } = require('./capture');

function attachApplyResponseCapture(page) {
  const captured = [];
  const handler = async (res) => {
    const url = res.url();
    if (!/naukri\.com/i.test(url)) return;
    if (!/apply|application|screen|chatbot/i.test(url)) return;
    let body = null;
    try {
      body = await res.text();
    } catch {
      /* non-text body, ignore */
    }
    captured.push({
      url,
      status: res.status(),
      method: res.request().method(),
      body: body ? body.slice(0, 2000) : null,
    });
  };
  page.on('response', handler);
  return { captured, detach: () => page.off('response', handler) };
}

// Ground truth, not guesswork: network responses from Naukri's own apply
// endpoint(s) are the primary success signal, DOM text is the fallback.
// (The exact endpoint path wasn't safe to pin down without live-clicking a
// real application during development - this filters broadly on naukri.com
// + apply-shaped URLs and logs everything it saw into response_snapshot, so
// the real endpoint becomes obvious from the first few real runs.)
async function applyToJob(context, page, job) {
  const selectors = loadSelectors();

  await page.goto(job.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2500);

  const classification = await classifyApplyAffordance(page, selectors.detail);

  if (classification.kind === 'already_applied') {
    return { outcome: 'applied', reason: 'already applied (detected before clicking anything)' };
  }
  if (classification.kind === 'external') {
    return {
      outcome: 'skipped_external',
      reason: 'external application ("Apply on company site") - not attempted, Naukri can\'t complete this one',
    };
  }
  if (classification.kind === 'selector_miss') {
    const capture = await captureDiagnostic(page, job, 'no known apply affordance found (not native, not external, not already-applied)');
    return { outcome: 'needs_review', subtype: 'selector_miss', ...capture };
  }

  const { captured: responses, detach } = attachApplyResponseCapture(page);
  const popupPromise = context.waitForEvent('page', { timeout: 6000 }).catch(() => null);

  await classification.locator.click();
  const popup = await popupPromise;
  await page.waitForTimeout(2000); // settle before reading DOM/network signals
  detach();

  if (popup) {
    const externalUrl = popup.url();
    await popup.close().catch(() => {});
    return {
      outcome: 'skipped_external',
      reason: 'apply click opened a new tab/site (not caught by the pre-click classifier)',
      externalUrl,
      response_snapshot: responses.length ? responses : null,
    };
  }

  const successFromNetwork = responses.some((r) => r.status >= 200 && r.status < 300);
  const successFromDom = await checkAppliedSuccess(page, selectors.detail);
  if (successFromNetwork || successFromDom) {
    return { outcome: 'applied', response_snapshot: responses.length ? responses : null };
  }

  const chatbotResult = await resolveChatbot(page, job, selectors.detail);
  if (chatbotResult) {
    return { ...chatbotResult, response_snapshot: responses.length ? responses : null };
  }

  const capture = await captureDiagnostic(page, job, 'clicked apply but could not confirm success or find a chatbot dialog');
  return { outcome: 'needs_review', subtype: 'unconfirmed_outcome', response_snapshot: responses.length ? responses : null, ...capture };
}

module.exports = { applyToJob };
