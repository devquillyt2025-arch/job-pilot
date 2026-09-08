// Classifies what's on a job detail page BEFORE clicking anything, so
// "already applied", "external ATS" and "genuine layout drift" never get
// lumped into one generic bucket. Verified live on real Naukri pages:
//   - Naukri-native apply: <button id="apply-button">Apply</button>
//   - External ATS: <button id="company-site-button">Apply on company site</button>
//   - Already applied: the button disappears entirely and the page shows
//     plain "Applied" text instead.
// Falls back through role- and text-based locators (a job posting occasionally
// ships without stable ids) before declaring a selector miss.
async function classifyApplyAffordance(page, selectors) {
  const naukriBtn = page.locator(selectors.naukriApplyButton).first();
  if ((await naukriBtn.count().catch(() => 0)) > 0) {
    const text = ((await naukriBtn.textContent().catch(() => '')) || '').trim();
    if (text.toLowerCase() === selectors.appliedIndicatorText.toLowerCase()) {
      return { kind: 'already_applied' };
    }
    return { kind: 'naukri', locator: naukriBtn };
  }

  const externalBtn = page.locator(selectors.externalApplyButton).first();
  if ((await externalBtn.count().catch(() => 0)) > 0) {
    return { kind: 'external' };
  }

  const alreadyAppliedFallback = await page
    .evaluate((indicator) => {
      const target = indicator.toLowerCase();
      return Array.from(document.querySelectorAll('span, div, button')).some(
        (el) => el.children.length === 0 && el.textContent.trim().toLowerCase() === target
      );
    }, selectors.appliedIndicatorText)
    .catch(() => false);
  if (alreadyAppliedFallback) return { kind: 'already_applied' };

  const roleBtn = page.getByRole('button', { name: /^apply$/i }).first();
  if ((await roleBtn.count().catch(() => 0)) > 0) {
    return { kind: 'naukri', locator: roleBtn };
  }

  const textBtn = page.locator('button:has-text("Apply"), a:has-text("Apply")').first();
  if ((await textBtn.count().catch(() => 0)) > 0) {
    const text = ((await textBtn.textContent().catch(() => '')) || '').toLowerCase();
    if (text.includes('company site')) return { kind: 'external' };
    return { kind: 'naukri', locator: textBtn };
  }

  return { kind: 'selector_miss' };
}

async function checkAppliedSuccess(page, selectors) {
  return page
    .evaluate((indicator) => {
      if (/applied to "/i.test(document.body.innerText)) return true;
      const btn = document.getElementById('apply-button');
      if (btn) return btn.textContent.trim().toLowerCase() === indicator.toLowerCase();
      const target = indicator.toLowerCase();
      return Array.from(document.querySelectorAll('span, div, button')).some(
        (el) => el.children.length === 0 && el.textContent.trim().toLowerCase() === target
      );
    }, selectors.appliedIndicatorText)
    .catch(() => false);
}

module.exports = { classifyApplyAffordance, checkAppliedSuccess };
