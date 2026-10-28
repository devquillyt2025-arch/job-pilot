const fs = require('fs');
const path = require('path');
// Explicit path: the dashboard server runs with cwd = dashboard/, where a bare
// config() would look for dashboard/.env and never find DATABASE_URL.
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

function loadJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8'));
}

function loadSelectors() {
  return loadJson('config/selectors.json');
}

function loadQaBank() {
  return loadJson('config/qa-bank.json');
}

const profile = loadJson('config/profile.json');
const settings = loadJson('config/settings.json');

const credentials = {
  email: process.env.NAUKRI_EMAIL,
  password: process.env.NAUKRI_PASSWORD,
};

const paths = {
  root: path.join(__dirname, '..'),
  session: path.join(__dirname, '..', 'data', 'session', 'storageState.json'),
  // legacy JSON store (pre-Neon), read only by `npm run db:import`
  db: path.join(__dirname, '..', 'data', 'autojob.json'),
  logs: path.join(__dirname, '..', 'data', 'logs'),
  selectorMisses: path.join(__dirname, '..', 'data', 'selector-misses'),
  selectorsFile: path.join(__dirname, '..', 'config', 'selectors.json'),
  qaBankFile: path.join(__dirname, '..', 'config', 'qa-bank.json'),
  // legacy, kept only for the one-time migration script
  legacyQueue: path.join(__dirname, '..', 'data', 'queue.json'),
  legacyApplied: path.join(__dirname, '..', 'data', 'applied.json'),
};

module.exports = { profile, settings, credentials, paths, loadSelectors, loadQaBank };
