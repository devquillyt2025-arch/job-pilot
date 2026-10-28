function normalize(text) {
  return String(text || '').toLowerCase();
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Whole-word match, so "walkin" doesn't hit "walking" and "ai" doesn't hit
// "maintenance". Boundaries are "not a letter/digit" rather than \b so terms
// like "node.js" and "c++" still work.
function hasWord(haystack, term) {
  const t = normalize(term).trim();
  if (!t) return false;
  return new RegExp(`(?<![a-z0-9])${escapeRegExp(t)}(?![a-z0-9])`).test(haystack);
}

// Skills: short acronyms ("LLM", "RAG", "RPA", "SQL") must be whole words -
// as substrings they match "fulfillment", "storage", etc. Longer names keep
// substring matching so "React" still counts in "ReactJS".
function mentionsSkill(haystack, skill) {
  const s = normalize(skill).trim();
  if (!s) return false;
  return s.length <= 4 ? hasWord(haystack, s) : haystack.includes(s);
}

function parseExperienceRange(text) {
  // e.g. "2-3 Yrs", "5-9 years", "0-1 Yrs"
  const match = normalize(text).match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
  if (!match) return null;
  return { min: parseFloat(match[1]), max: parseFloat(match[2]) };
}

function parseSalaryLakhs(text) {
  // e.g. "10-15 Lacs PA", "12 Lacs PA". Returns null for "Not disclosed" or
  // anything not quoted in lakhs, so those are left to Naukri's own filter.
  const t = normalize(text).replace(/,/g, '');
  if (!/lac|lakh/.test(t)) return null;
  const nums = (t.match(/\d+(?:\.\d+)?/g) || []).map(parseFloat);
  if (nums.length === 0) return null;
  return { min: nums[0], max: nums[nums.length - 1] };
}

function scoreJob(job, profile) {
  const allowedLocations = (profile.allowedLocations || []).map(normalize);
  const jobLocation = normalize(job.location);
  if (allowedLocations.length > 0 && jobLocation && !allowedLocations.some((loc) => jobLocation.includes(loc))) {
    return { score: 0, excluded: true, reason: `location not allowed: ${job.location}`, matchedMustHave: [], matchedNiceToHave: [] };
  }

  const salary = parseSalaryLakhs(job.salary);
  if (salary && typeof profile.minSalaryLakhs === 'number' && salary.max < profile.minSalaryLakhs) {
    return { score: 0, excluded: true, reason: `salary below minimum: ${job.salary}`, matchedMustHave: [], matchedNiceToHave: [] };
  }

  const haystack = normalize(
    [job.title, job.description, (job.skills || []).join(' ')].join(' ')
  );
  const companyName = normalize(job.company);

  for (const bad of profile.excludeKeywords || []) {
    if (bad && hasWord(haystack, bad)) {
      return { score: 0, excluded: true, reason: `excluded keyword: ${bad}`, matchedMustHave: [], matchedNiceToHave: [] };
    }
  }
  for (const bad of profile.excludeCompanies || []) {
    if (bad && companyName.includes(normalize(bad))) {
      return { score: 0, excluded: true, reason: `excluded company: ${bad}`, matchedMustHave: [], matchedNiceToHave: [] };
    }
  }

  const mustHave = profile.mustHaveSkills || [];
  const matchedMustHave = mustHave.filter((skill) => mentionsSkill(haystack, skill));
  if (mustHave.length > 0 && matchedMustHave.length === 0) {
    return {
      score: 0,
      excluded: true,
      reason: 'no must-have skills matched',
      matchedMustHave: [],
      matchedNiceToHave: [],
    };
  }

  // Flat credit for clearing the must-have gate, plus a small capped bonus
  // per extra match - NOT proportional to list length. mustHaveSkills is an
  // OR-gate meant to cover several unrelated role types at once (e.g.
  // Node.js backend roles AND AI engineer roles in the same list); scoring
  // by fraction-of-list would silently crater a Node.js job's score every
  // time an unrelated AI/automation keyword gets added to the list.
  let score = 0;
  if (mustHave.length > 0) {
    score += 40 + Math.min(matchedMustHave.length - 1, 3) * 4;
  } else {
    score += 40; // no must-haves configured -> don't penalize
  }

  const niceToHave = profile.niceToHaveSkills || [];
  const matchedNiceToHave = niceToHave.filter((skill) => mentionsSkill(haystack, skill));
  score += Math.min(matchedNiceToHave.length, 6) * 4;

  const queryWords = (profile.searchQueries || [])
    .flatMap((q) => normalize(q.keywords).split(/\s+/))
    .filter(Boolean);
  const titleText = normalize(job.title);
  if (queryWords.some((w) => hasWord(titleText, w))) {
    score += 10;
  }

  const range = parseExperienceRange(job.experience);
  if (range && typeof profile.experienceYears === 'number') {
    const { min, max } = range;
    const target = profile.experienceYears;
    if (target >= min && target <= max) {
      score += 10;
    } else if (target >= min - 1 && target <= max + 1) {
      score += 5;
    }
  }

  return {
    score: Math.round(Math.min(100, score)),
    excluded: false,
    reason: null,
    matchedMustHave,
    matchedNiceToHave,
  };
}

module.exports = { scoreJob, parseExperienceRange, parseSalaryLakhs };
