 const { loadSelectors, loadQaBank } = require('../config');
const { checkAppliedSuccess } = require('./classify');
const { captureDiagnostic } = require('./capture');

// Naukri's screening chatbot rewords the same underlying question per
// posting ("What's your notice period?" vs "How soon can you join?"), so
// exact string matching would keep missing - fuzzy-match instead.
async function fuzzyMatchQuestion(question) {
  const Fuse = (await import('fuse.js')).default;
  const qaBank = loadQaBank();
  const fuse = new Fuse(qaBank.entries, { keys: ['question'], threshold: 0.3 });
  const [best] = fuse.search(question);
  return best ? best.item : null;
}

async function fillAnswer(page, chatbotSel, answer) {
  const optionButtons = page.locator(chatbotSel.optionButtons);
  const optionCount = await optionButtons.count().catch(() => 0);
  const target = String(answer).toLowerCase();

  for (let i = 0; i < optionCount; i++) {
    const text = ((await optionButtons.nth(i).textContent().catch(() => '')) || '').trim().toLowerCase();
    if (text && (text === target || text.includes(target) || target.includes(text))) {
      await optionButtons.nth(i).click();
      return true;
    }
  }

  const input = page.locator(chatbotSel.textInput).first();
  if ((await input.count().catch(() => 0)) > 0) {
    await input.fill(String(answer));
    return true;
  }

  return false;
}

// Resolves one chatbot "turn" and recurses for multi-question flows, bounded
// by maxDepth. Never invents an answer: an unmatched question, an unfilled
// answer, or an unconfirmed outcome all fall through to needs_review with a
// full screenshot + HTML capture rather than guessing.
async function resolveChatbot(page, job, detailSelectors, maxDepth = 5) {
  const chatbotSel = loadSelectors().chatbot;

  if (maxDepth <= 0) {
    const capture = await captureDiagnostic(page, job, 'chatbot flow exceeded max question depth');
    return { outcome: 'needs_review', subtype: 'unconfirmed_outcome', ...capture };
  }

  const containerCount = await page.locator(chatbotSel.container).count().catch(() => 0);
  if (containerCount === 0) {
    // no dialog left - flow ended some other way, let caller re-check success
    return null;
  }

  const questionRaw = await page.locator(chatbotSel.questionText).first().textContent().catch(() => '');
  const question = (questionRaw || '').trim();

  if (!question) {
    const capture = await captureDiagnostic(
      page,
      job,
      'chatbot dialog detected but the configured questionText selector matched nothing - selectors.json needs calibration'
    );
    return { outcome: 'needs_review', subtype: 'selector_miss', question: null, ...capture };
  }

  const match = await fuzzyMatchQuestion(question);
  if (!match || !match.answer) {
    const capture = await captureDiagnostic(
      page,
      job,
      match
        ? `matched qa-bank entry "${match.question}" but it has no answer configured yet`
        : 'no matching entry in qa-bank.json for this question'
    );
    return { outcome: 'needs_review', subtype: 'unanswered_question', question, ...capture };
  }

  const filled = await fillAnswer(page, chatbotSel, match.answer);
  if (!filled) {
    const capture = await captureDiagnostic(
      page,
      job,
      `matched question "${question}" (answer "${match.answer}") but found no option/input to fill`
    );
    return { outcome: 'needs_review', subtype: 'selector_miss', question, ...capture };
  }

  const submitBtn = page.locator(chatbotSel.submitButton).first();
  if ((await submitBtn.count().catch(() => 0)) > 0) {
    await submitBtn.click();
  }
  await page.waitForTimeout(1800);

  if (await checkAppliedSuccess(page, detailSelectors)) {
    return { outcome: 'applied' };
  }

  const stillOpen = await page.locator(chatbotSel.container).count().catch(() => 0);
  if (stillOpen > 0) {
    return resolveChatbot(page, job, detailSelectors, maxDepth - 1);
  }

  const capture = await captureDiagnostic(page, job, 'answered a screening question but could not confirm the final outcome afterward');
  return { outcome: 'needs_review', subtype: 'unconfirmed_outcome', ...capture };
}

module.exports = { resolveChatbot, fuzzyMatchQuestion };
