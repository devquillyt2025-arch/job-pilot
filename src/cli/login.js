const readline = require('readline');
const { launchContext, saveSession } = require('../browser');
const { fillLoginForm } = require('../auth/login');
const { isLoggedIn } = require('../auth/session');

function waitForEnter(promptText) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(promptText, () => {
    rl.close();
    resolve();
  }));
}

(async () => {
  console.log('Opening a visible Naukri login window...');
  const { browser, context } = await launchContext({ visible: true });
  const page = await context.newPage();
  await fillLoginForm(page);

  console.log('\nA browser window has opened to the Naukri login page.');
  console.log('Log in there (email/password are pre-filled if set in .env; solve any captcha/OTP if prompted).');
  await waitForEnter('Once you are fully logged in and see your Naukri homepage, press Enter here... ');

  const loggedIn = await isLoggedIn(page);
  if (!loggedIn) {
    console.error('\nCould not confirm you are logged in (still seeing the login page). Session was NOT saved.');
    console.error('Run "npm run login" again and make sure login fully completes before pressing Enter.');
    await browser.close();
    process.exit(1);
  }

  await saveSession(context);
  console.log('\nLogin session saved to data/session/storageState.json.');
  console.log('You can now run "npm run search" and, after reviewing matches, "npm run apply".');
  await browser.close();
})();
