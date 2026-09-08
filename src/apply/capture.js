const fs = require('fs');
const path = require('path');
const { paths } = require('../config');

// Shared diagnostic capture used whenever the automation can't confidently
// classify what it's looking at. Written for humans: a screenshot plus the
// raw HTML, so a selector can be patched (via the dashboard) from what
// actually happened instead of a guess.
async function captureDiagnostic(page, job, reason) {
  fs.mkdirSync(paths.selectorMisses, { recursive: true });
  const stamp = Date.now();
  const base = `${job.id || job.jobId || 'unknown'}-${stamp}`;
  const screenshot_path = path.join(paths.selectorMisses, `${base}.png`);
  const html_path = path.join(paths.selectorMisses, `${base}.html`);

  await page.screenshot({ path: screenshot_path, fullPage: true }).catch(() => {});
  const html = await page.content().catch(() => '');
  fs.writeFileSync(html_path, html);

  return { screenshot_path, html_path, reason };
}

module.exports = { captureDiagnostic };
