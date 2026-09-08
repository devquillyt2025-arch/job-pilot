// One-time import of the old queue.json/applied.json files into the new
// lowdb store. Six jobs from the prior run were re-checked live (read-only,
// no re-clicking) on 2026-09-08 to get their real outcome, since the old
// detector's "manual_required"/"unknown" buckets were proven wrong for most
// of them - see the corrections map below. Anything outside that known set
// falls back to a generic, conservative mapping.
const fs = require('fs');
const { paths } = require('../config');
const { getDb } = require('./db');

// jobId -> verified real status + reason, from live (read-only) inspection.
const VERIFIED_CORRECTIONS = {
  '040926928256': { status: 'applied', reason: 'confirmed applied on revisit (page showed static "Applied", no button)' },
  '040926928262': { status: 'applied', reason: 'confirmed applied via saved screenshot ("Applied to ...")' },
  '040926925947': { status: 'applied', reason: 'confirmed applied via saved screenshot ("Applied to ...")' },
  '260826028955': { status: 'needs_review', reason: 'chatbot/screening dialog appeared and was never completed - still shows "Apply" on revisit' },
  '110223500594': { status: 'skipped_external', reason: 'external application - real button is #company-site-button ("Apply on company site")' },
  '221125500869': { status: 'skipped_external', reason: 'external application - real button is #company-site-button ("Apply on company site")' },
};

function mapLegacyStatus(oldStatus) {
  switch (oldStatus) {
    case 'applied':
      return 'applied';
    case 'approved':
      return 'approved';
    case 'rejected':
      return 'rejected';
    case 'manual_required':
    case 'unknown':
      return 'needs_review';
    default:
      return 'pending';
  }
}

async function migrate() {
  if (!fs.existsSync(paths.legacyQueue)) {
    console.log('No legacy data/queue.json found - nothing to migrate.');
    return;
  }

  const legacyQueue = JSON.parse(fs.readFileSync(paths.legacyQueue, 'utf8'));
  const db = await getDb();

  let imported = 0;
  let corrected = 0;

  for (const [id, item] of Object.entries(legacyQueue)) {
    if (db.data.jobs[id]) continue; // already migrated

    const correction = VERIFIED_CORRECTIONS[id];
    const status = correction ? correction.status : mapLegacyStatus(item.status);
    const reason = correction ? correction.reason : item.notes || null;
    if (correction) corrected++;

    db.data.jobs[id] = {
      id,
      url: item.url,
      role: item.title,
      company: item.company,
      location: item.location,
      experience: item.experience,
      skills: item.skills,
      postedDay: item.postedDay,
      match_score: item.score,
      matchedMustHave: item.matchedMustHave,
      matchedNiceToHave: item.matchedNiceToHave,
      status,
      reason,
      response_snapshot: null,
      screenshot_path: null,
      created_at: item.foundAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    imported++;
  }

  await db.write();
  console.log(`Migrated ${imported} job(s) from legacy queue.json (${corrected} corrected using verified live-inspection results).`);
}

if (require.main === module) {
  migrate().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}

module.exports = { migrate, VERIFIED_CORRECTIONS };
