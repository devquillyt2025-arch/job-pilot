const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { settings, paths } = require('./config');

// Naukri's Akamai bot-management blocks headless Chromium outright (confirmed:
// a plain headless request to a public search page returns an instant "Access
// Denied"). Running headed with navigator.webdriver patched loads normally.
// So this never launches with headless:true - for unattended/scheduled runs
// we instead push the window off-screen so it doesn't visibly pop up.
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function launchContext({ visible = false } = {}) {
  const args = [];
  if (!visible && settings.offscreenWindow) {
    args.push('--window-position=-32000,-32000');
  }

  const browser = await chromium.launch({ headless: false, args });

  const hasSession = fs.existsSync(paths.session);
  const context = await browser.newContext({
    userAgent: USER_AGENT,
    viewport: { width: 1366, height: 768 },
    storageState: hasSession ? paths.session : undefined,
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  return { browser, context };
}

async function saveSession(context) {
  fs.mkdirSync(path.dirname(paths.session), { recursive: true });
  await context.storageState({ path: paths.session });
}

function hasSavedSession() {
  return fs.existsSync(paths.session);
}

module.exports = { launchContext, saveSession, hasSavedSession, USER_AGENT };
