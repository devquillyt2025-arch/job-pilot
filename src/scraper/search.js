const { slugify } = require('./slugify');
const { randomDelay } = require('../util/delay');
const { settings, profile, loadSelectors } = require('../config');

// Naukri's own SRP filter values (the same params its filter sidebar sets).
const WFH_TYPES = { office: '0', remote: '2', hybrid: '3' };
const CTC_BUCKETS = [
  { min: 0, param: '0to3' },
  { min: 3, param: '3to6' },
  { min: 6, param: '6to10' },
  { min: 10, param: '10to15' },
  { min: 15, param: '15to25' },
  { min: 25, param: '25to50' },
  { min: 50, param: '50to75' },
  { min: 75, param: '75to100' },
];

function buildFilterParams() {
  const params = new URLSearchParams();
  for (const mode of profile.workModes || []) {
    const value = WFH_TYPES[String(mode).toLowerCase()];
    if (value) params.append('wfhType', value);
  }
  if (typeof profile.minSalaryLakhs === 'number' && profile.minSalaryLakhs > 0) {
    for (const bucket of CTC_BUCKETS) {
      if (bucket.min >= profile.minSalaryLakhs) params.append('ctcFilter', bucket.param);
    }
  }
  return params.toString();
}

function buildSearchUrl({ keywords, location }, pageNumber) {
  const base = location
    ? `https://www.naukri.com/${slugify(keywords)}-jobs-in-${slugify(location)}`
    : `https://www.naukri.com/${slugify(keywords)}-jobs`;
  const path = pageNumber > 1 ? `${base}-${pageNumber}` : base;
  const query = buildFilterParams();
  return query ? `${path}?${query}` : path;
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
          salary: sel.salary ? text(card.querySelector(sel.salary)) : '',
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
