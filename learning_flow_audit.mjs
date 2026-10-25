import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';

const base = process.env.MANGA_GO_URL || 'http://127.0.0.1:4173';
const book = JSON.parse(await readFile(new URL('./interactive/data/book.json', import.meta.url), 'utf8'));
const browser = await chromium.launch({channel: 'chrome', headless: true});
const evidence = {status: 'fail', desktop: {}, starter: {}, agent: {}, mobile: {}, route: {}};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function stableClick(page, locator, waitFor) {
  await locator.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => window.scrollY);
  await locator.click();
  if (waitFor) await waitFor();
  await page.waitForTimeout(80);
  const after = await page.evaluate(() => window.scrollY);
  return {before, after, delta: Math.abs(after - before)};
}

try {
  const freshContext = await browser.newContext({viewport: {width: 1280, height: 900}, reducedMotion: 'reduce'});
  const fresh = await freshContext.newPage();
  await fresh.goto(`${base}/`, {waitUntil: 'networkidle'});
  await fresh.evaluate(() => localStorage.clear());
  await fresh.reload({waitUntil: 'networkidle'});
  evidence.starter.continueHidden = await fresh.locator('#continueButton').isHidden();
  await fresh.locator('#startButton').click();
  evidence.starter.panelVisible = await fresh.locator('#starterPanel').isVisible();
  evidence.starter.answerHiddenBeforeRun = await fresh.locator('.starter-reveal').isHidden();
  await fresh.locator('.starter-prediction').fill('100');
  await fresh.locator('.starter-run').click();
  await fresh.locator('.starter-output').filter({hasText: '100'}).waitFor({timeout: 30000});
  evidence.starter.answerVisibleAfterRun = await fresh.locator('.starter-reveal').isVisible();
  evidence.starter.nextLockedAfterOriginal = await fresh.locator('.starter-next').isDisabled();
  const changedStarterCode = (await fresh.locator('.starter-editor').inputValue()).replace('fmt.Println(100)', 'fmt.Println(80)');
  await fresh.locator('.starter-editor').evaluate((editor, code) => {
    editor.value = code;
    editor.dispatchEvent(new Event('input', {bubbles: true}));
  }, changedStarterCode);
  await fresh.locator('.starter-prediction').fill('80');
  await fresh.locator('.starter-run').click();
  await fresh.locator('.starter-output').filter({hasText: '80'}).waitFor({timeout: 30000});
  evidence.starter.nextEnabledAfterVerifiedChange = await fresh.locator('.starter-next').isEnabled();
  evidence.starter.twoChecksVisible = await fresh.locator('.starter-verification-status .is-complete').count() === 2;
  assert(Object.values(evidence.starter).every(Boolean), 'starter does not enforce predict -> run -> reveal');
  await freshContext.close();

  const context = await browser.newContext({viewport: {width: 1440, height: 1000}, reducedMotion: 'reduce'});
  const page = await context.newPage();
  await page.goto(`${base}/#chapter-1`, {waitUntil: 'networkidle'});
  await page.evaluate(() => {
    localStorage.removeItem('manga-go-practices');
    localStorage.removeItem('jianjian-answered');
    localStorage.removeItem('jianjian-responses');
  });
  await page.reload({waitUntil: 'networkidle'});

  evidence.desktop.continuousFlow = await page.evaluate(() => ({
    code: Boolean(document.querySelector('#codeCard')?.offsetParent),
    storyHook: Boolean(document.querySelector('#comicOpening')?.offsetParent),
    hiddenStageRules: document.querySelectorAll('[data-stage]').length,
    legacyAnchors: document.querySelectorAll('[data-lesson-anchor]').length,
    lessonTasks: document.querySelectorAll('[data-lesson-task]').length,
    workspaceColumns: getComputedStyle(document.querySelector('#lessonWorkspace')).gridTemplateColumns.split(' ').length,
    mobileTabsHidden: !document.querySelector('.lesson-mobile-tabs')?.offsetParent,
  }));
  assert(evidence.desktop.continuousFlow.code && evidence.desktop.continuousFlow.storyHook, 'observe task does not pair the scene with runnable code');
  assert(evidence.desktop.continuousFlow.hiddenStageRules === 0, 'legacy stage controls remain');
  assert(evidence.desktop.continuousFlow.legacyAnchors === 0 && evidence.desktop.continuousFlow.lessonTasks === 3, 'lesson task model is not the expected three-task flow');
  assert(evidence.desktop.continuousFlow.workspaceColumns === 2 && evidence.desktop.continuousFlow.mobileTabsHidden, 'desktop lesson is not a two-column workspace');
  assert(await page.locator('#supplementList').isHidden(), 'observe task leaks the optional supplement list');
  evidence.desktop.understandTask = await stableClick(page, page.locator('[data-lesson-task="understand"]'));
  assert(evidence.desktop.understandTask.delta <= 2, `understand task moved the page by ${evidence.desktop.understandTask.delta}px`);
  assert(await page.locator('#mechanismSection').isVisible() && await page.locator('#codeCard').isVisible(), 'understand task does not keep explanation and code together');
  assert(await page.locator('#supplementList').isHidden(), 'understand task leaks the optional supplement list');
  evidence.desktop.practiceTask = await stableClick(page, page.locator('[data-lesson-task="practice"]'));
  assert(evidence.desktop.practiceTask.delta <= 2, `practice task moved the page by ${evidence.desktop.practiceTask.delta}px`);
  assert(await page.locator('#exerciseCard').isVisible() && await page.locator('#completionChecklist').isVisible(), 'practice task does not show exercise and completion state');
  assert(await page.locator('#supplementList').isVisible(), 'practice task does not expose optional supplements');
  await page.locator('[data-lesson-task="observe"]').click();
  await page.evaluate(() => window.scrollTo(0, 700));
  evidence.desktop.stickyTaskSwitch = await stableClick(page, page.locator('[data-lesson-task="understand"]'));
  assert(evidence.desktop.stickyTaskSwitch.delta <= 8, `sticky desktop task switch moved the page by ${evidence.desktop.stickyTaskSwitch.delta}px`);
  evidence.desktop.workspaceBlank = await page.locator('#lessonWorkspace').evaluate((workspace) => Math.max(0, workspace.getBoundingClientRect().bottom - Math.max(...[...workspace.children].map((child) => child.getBoundingClientRect().bottom))));
  assert(evidence.desktop.workspaceBlank <= page.viewportSize().height, `desktop workspace retained ${evidence.desktop.workspaceBlank}px of empty height`);
  await page.locator('[data-lesson-task="observe"]').click();

  const chapter = book.chapters[0];
  await page.locator(`.foundation-prediction input[value="${chapter.foundationLesson.prediction.correctIndex}"]`).check();
  evidence.desktop.predictionScroll = await stableClick(page, page.locator('[data-check-prediction]'));
  assert(evidence.desktop.predictionScroll.delta <= 2, `prediction moved the page by ${evidence.desktop.predictionScroll.delta}px`);

  const runButton = page.locator('.foundation-code-shell [data-run-foundation]');
  evidence.desktop.runScroll = await stableClick(page, runButton, () => page.locator('.foundation-code-shell .run-result.success').waitFor({timeout: 30000}));
  evidence.desktop.resultTookFocus = await page.evaluate(() => document.activeElement?.classList.contains('run-result') === true);
  assert(evidence.desktop.runScroll.delta <= 2, `running code moved the page by ${evidence.desktop.runScroll.delta}px`);
  assert(!evidence.desktop.resultTookFocus, 'running code forced focus into the result panel');

  await page.locator('[data-lesson-task="practice"]').click();
  const hint = page.locator('.exercise-hints details').first().locator('summary');
  evidence.desktop.hintScroll = await stableClick(page, hint);
  assert(evidence.desktop.hintScroll.delta <= 2, `opening a hint moved the page by ${evidence.desktop.hintScroll.delta}px`);

  await page.locator('#supplementList').scrollIntoViewIfNeeded();
  const originY = await page.evaluate(() => window.scrollY);
  const originAnchorTop = await page.locator('#supplementList').evaluate((element) => element.getBoundingClientRect().top);
  const supplementButton = page.locator('#supplementList [data-supplement]').first();
  const supplementID = await supplementButton.getAttribute('data-supplement');
  await supplementButton.click();
  await page.waitForURL(`**/#${supplementID}`);
  await page.locator('[data-return-chapter]').click();
  await page.waitForURL('**/#chapter-1');
  await page.waitForTimeout(120);
  const restoredY = await page.evaluate(() => window.scrollY);
  const restoredAnchorTop = await page.locator('#supplementList').evaluate((element) => element.getBoundingClientRect().top);
  evidence.desktop.supplementReturn = {originY, restoredY, originAnchorTop, restoredAnchorTop, delta: Math.abs(restoredAnchorTop - originAnchorTop)};
  assert(evidence.desktop.supplementReturn.delta <= 12, `supplement return lost its logical anchor by ${evidence.desktop.supplementReturn.delta}px`);

  const routeOrder = await page.locator('#chapterNav [data-unit]').evaluateAll((nodes) => nodes.map((node) => node.dataset.unit));
  evidence.route = {
    chapter23: routeOrder.indexOf('chapter-23'),
    chapter24: routeOrder.indexOf('chapter-24'),
    milestone3: routeOrder.indexOf('supplement-go-ai-03'),
    milestone4: routeOrder.indexOf('supplement-go-ai-04'),
    milestone8: routeOrder.indexOf('supplement-go-ai-08'),
    capstoneLab: book.chapters.find((chapter) => chapter.id === 'chapter-24')?.projectLab?.id,
  };
  assert(evidence.route.milestone3 < evidence.route.milestone4, 'milestone numbering must stay in learner-visible order');
  assert(evidence.route.chapter23 < evidence.route.milestone8 && evidence.route.milestone8 < evidence.route.chapter24, 'final assembly must follow milestone 8');
  assert(evidence.route.capstoneLab === 'ledger-agent-lab/capstone', 'chapter 24 does not use the dedicated capstone lab');

  await page.goto(`${base}/#chapter-17`, {waitUntil: 'networkidle'});
  evidence.agent.runDisabledBeforePrediction = await page.locator('.agent-quickstart [data-run-unit]').isDisabled();
  await page.locator('[data-agent-prediction][value="0"]').check();
  evidence.agent.runEnabledAfterPrediction = await page.locator('.agent-quickstart [data-run-unit]').isEnabled();
  await page.locator('.agent-quickstart [data-run-unit]').click();
  await page.locator('.agent-quickstart .run-result.success').waitFor({timeout: 60000});
  evidence.agent.feedbackConnectsPrediction = (await page.locator('.agent-quickstart .failure-guide').textContent()).includes('预测对了');
  evidence.agent.fourStageTraceVerified = await page.locator('.agent-state-track.verified li.done').count() === 4;
  const exerciseTitle = await page.locator('[data-code-exercise] h3').textContent();
  const exerciseIntent = await page.locator('[data-code-exercise] .test-intent').textContent();
  evidence.agent.exerciseAligned = exerciseTitle.includes('订单草稿') && exerciseIntent.includes('未确认') && exerciseIntent.includes('订单列表');
  assert(Object.values(evidence.agent).every(Boolean), 'chapter 17 prediction, feedback, and exercise are not aligned');
  await context.close();

  const mobileContext = await browser.newContext({viewport: {width: 390, height: 844}, reducedMotion: 'reduce'});
  const mobile = await mobileContext.newPage();
  await mobile.goto(`${base}/#chapter-1`, {waitUntil: 'networkidle'});
  evidence.mobile = await mobile.evaluate(() => ({
    taskbarPosition: getComputedStyle(document.querySelector('.lesson-taskbar')).position,
    overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
    taskLabelsVisible: [...document.querySelectorAll('[data-lesson-task] b')].every((node) => getComputedStyle(node).display !== 'none'),
    lessonTasks: document.querySelectorAll('[data-lesson-task]').length,
    tabsVisible: Boolean(document.querySelector('.lesson-mobile-tabs')?.offsetParent),
    explainInitiallyVisible: Boolean(document.querySelector('#lessonExplainPane')?.offsetParent),
    practiceInitiallyHidden: document.querySelector('#lessonPracticePane').hidden && document.querySelector('#lessonPracticePane').inert,
    contractColumnsVisible: [...document.querySelectorAll('#lessonContract > div')].every((node) => {
      const rect = node.getBoundingClientRect();
      return rect.left >= 0 && rect.right <= innerWidth;
    }),
  }));
  assert(evidence.mobile.taskbarPosition === 'sticky', `mobile taskbar is ${evidence.mobile.taskbarPosition}, expected sticky`);
  assert(evidence.mobile.overflow === 0, `mobile page overflows by ${evidence.mobile.overflow}px`);
  assert(evidence.mobile.taskLabelsVisible && evidence.mobile.lessonTasks === 3, 'mobile task navigation is incomplete');
  assert(evidence.mobile.tabsVisible && evidence.mobile.explainInitiallyVisible && evidence.mobile.practiceInitiallyHidden, 'mobile explain/code tab contract is not active');
  assert(evidence.mobile.contractColumnsVisible, 'mobile lesson contract hides one of its three columns');
  await mobile.evaluate(() => window.scrollTo(0, 650));
  evidence.mobile.stickyTaskSwitch = await stableClick(mobile, mobile.locator('[data-lesson-task="understand"]'));
  assert(evidence.mobile.stickyTaskSwitch.delta <= 8, `sticky mobile task switch moved the page by ${evidence.mobile.stickyTaskSwitch.delta}px`);
  evidence.mobile.workspaceBlank = await mobile.locator('#lessonWorkspace').evaluate((workspace) => Math.max(0, workspace.getBoundingClientRect().bottom - Math.max(...[...workspace.children].filter((child) => !child.hidden).map((child) => child.getBoundingClientRect().bottom))));
  assert(evidence.mobile.workspaceBlank <= mobile.viewportSize().height, `mobile workspace retained ${evidence.mobile.workspaceBlank}px of empty height`);
  await mobile.locator('[data-lesson-task="understand"]').click();
  await mobile.locator('#mechanismSection').scrollIntoViewIfNeeded();
  const explainBefore = await mobile.locator('#mechanismSection').evaluate((element) => element.getBoundingClientRect().top);
  await mobile.locator('[data-lesson-pane="practice"]').click();
  await mobile.locator('#codeCard').scrollIntoViewIfNeeded();
  const practiceBefore = await mobile.locator('#codeCard').evaluate((element) => element.getBoundingClientRect().top);
  await mobile.locator('[data-lesson-pane="explain"]').click();
  await mobile.waitForTimeout(80);
  const explainAfter = await mobile.locator('#mechanismSection').evaluate((element) => element.getBoundingClientRect().top);
  await mobile.locator('[data-lesson-pane="practice"]').click();
  await mobile.waitForTimeout(80);
  const practiceAfter = await mobile.locator('#codeCard').evaluate((element) => element.getBoundingClientRect().top);
  evidence.mobile.paneRestore = {explainDelta: Math.abs(explainAfter - explainBefore), practiceDelta: Math.abs(practiceAfter - practiceBefore)};
  assert(evidence.mobile.paneRestore.explainDelta <= 12 && evidence.mobile.paneRestore.practiceDelta <= 12, `mobile pane position was not restored: ${JSON.stringify(evidence.mobile.paneRestore)}`);
  await mobile.locator('[data-lesson-task="practice"]').click();
  await mobile.locator('[data-lesson-pane="explain"]').click();
  await mobile.locator('#supplementList').scrollIntoViewIfNeeded();
  const mobileOriginTop = await mobile.locator('#supplementList').evaluate((element) => element.getBoundingClientRect().top);
  const mobileSupplement = mobile.locator('#supplementList [data-supplement]').first();
  const mobileSupplementID = await mobileSupplement.getAttribute('data-supplement');
  await mobileSupplement.click();
  await mobile.waitForURL(`**/#${mobileSupplementID}`);
  await mobile.locator('[data-return-chapter]').click();
  await mobile.waitForURL('**/#chapter-1');
  await mobile.waitForTimeout(160);
  evidence.mobile.supplementReturn = {
    pane: await mobile.locator('[data-lesson-pane="explain"]').getAttribute('aria-selected'),
    anchorDelta: Math.abs((await mobile.locator('#supplementList').evaluate((element) => element.getBoundingClientRect().top)) - mobileOriginTop),
  };
  assert(evidence.mobile.supplementReturn.pane === 'true' && evidence.mobile.supplementReturn.anchorDelta <= 12, `mobile supplement return lost its view or anchor: ${JSON.stringify(evidence.mobile.supplementReturn)}`);
  await mobileContext.close();

  evidence.status = 'pass';
  await writeFile(new URL('./evidence/learning-flow-v24.json', import.meta.url), `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify(evidence));
} finally {
  await browser.close();
}
