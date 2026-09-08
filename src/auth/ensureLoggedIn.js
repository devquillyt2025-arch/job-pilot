const { isLoggedIn } = require('./session');
const { attemptSilentLogin } = require('./login');

async function ensureLoggedIn(page) {
  if (await isLoggedIn(page)) return true;

  const loggedIn = await attemptSilentLogin(page);
  if (!loggedIn) {
    throw new Error(
      'Not logged in to Naukri and automatic login failed (likely a captcha/security ' +
        'check, or missing/incorrect NAUKRI_EMAIL / NAUKRI_PASSWORD in .env). ' +
        'Run "npm run login" to sign in manually, then re-run this command.'
    );
  }
  return true;
}

module.exports = { ensureLoggedIn };
