const { slugify } = require('./slugify');
const { randomDelay } = require('../util/delay');
const { settings, loadSelectors } = require('../config');

function buildSearchUrl({ keywords, location }, pageNumber) {
  const base = location
    ? `https://www.naukri.com/${slugify(keywords)}-jobs-in-${slugify(location)}`
    : `https://www.naukri.com/${slugify(keywords)}-jobs`;
  return pageNumber > 1 ? `${base}-${pageNumber}` : base;
}

async function scrapeCurrentPage(page) {
  const selectors = loadSelectors().search;
  return page.$$eval(
    selectors.jobCard,
    (cards, sel) => {
      return cards.map((card) => {
        const text = (el) => (el ? el.textContent.trim() : '');
        const titleEl = card.querySelector(sel.title);
        const skillEls = Array.from(card.querySelectorAll(sel.skillTags));
        return {
          jobId: card.getAttribute(sel.jobIdAttr) || '',
          url: titleEl ? titleEl.href : '',
          title: titleEl ? titleEl.getAttribute('title') || text(titleEl) : '',
          company: text(card.querySelector(sel.company)),
          experience: text(card.querySelector(sel.experience)),
          location: text(card.querySelector(sel.location)),
          description: text(card.querySelector(sel.description)),
          skills: skillEls.map((el) => el.textContent.trim()),
          postedDay: text(card.querySelector(sel.postedDay)),
        };
      });
    },
    selectors
  );
}

async function searchQuery(page, query, { maxPages, onPage } = {}) {
  const results = [];
  const pages = maxPages || 1;

  for (let pageNumber = 1; pageNumber <= pages; pageNumber++) {
    const url = buildSearchUrl(query, pageNumber);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2500);

    const jobs = await scrapeCurrentPage(page);
    if (jobs.length === 0) break; // ran out of pages/results

    results.push(...jobs);
    if (onPage) onPage(pageNumber, jobs.length);

    if (pageNumber < pages) {
      await randomDelay(settings.minActionDelayMs, settings.maxActionDelayMs);
    }
  }

  return results;
}

module.exports = { buildSearchUrl, scrapeCurrentPage, searchQuery };
