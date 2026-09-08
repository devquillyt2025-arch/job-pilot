const HOMEPAGE_URL = 'https://www.naukri.com/mnjuser/homepage';

// Naukri redirects unauthenticated visits to /mnjuser/homepage back to the
// login page (URL contains "nlogin"), so that redirect is what we check for.
async function isLoggedIn(page) {
  await page.goto(HOMEPAGE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  return !page.url().includes('nlogin');
}

module.exports = { isLoggedIn, HOMEPAGE_URL };
