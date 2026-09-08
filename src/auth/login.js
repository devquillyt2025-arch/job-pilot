const { credentials, loadSelectors } = require('../config');
const { isLoggedIn } = require('./session');

const LOGIN_URL = 'https://www.naukri.com/nlogin/login';

async function fillLoginForm(page) {
  const selectors = loadSelectors().login;
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
  if (credentials.email && credentials.password) {
    await page.fill(selectors.email, credentials.email);
    await page.fill(selectors.password, credentials.password);
  }
}

// Best-effort unattended login for scheduled runs, using the stored
// credentials. Naukri sometimes challenges logins with a captcha or OTP -
// when that happens this simply fails to log in (it never tries to solve a
// challenge), and the caller should surface a clear "run npm run login"
// instruction rather than hang waiting for a human that isn't there.
async function attemptSilentLogin(page) {
  if (!credentials.email || !credentials.password) return false;
  await fillLoginForm(page);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await page.waitForTimeout(4000);
  return isLoggedIn(page);
}

module.exports = { fillLoginForm, attemptSilentLogin, LOGIN_URL };
