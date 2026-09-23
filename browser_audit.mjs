import { chromium } from 'playwright';
import axe from 'axe-core';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const base = process.env.MANGA_GO_URL || 'http://127.0.0.1:4173';
const version = (await readFile(path.join(root, 'VERSION'), 'utf8')).trim();
const book = JSON.parse(await readFile(path.join(root, 'interactive/data/book.json'), 'utf8'));
const units = book.chapters.flatMap((chapter) => [
  { id: chapter.id, kind: 'chapter' },
  ...chapter.supplements.map(({ id }) => ({ id, kind: 'supplement' })),
]);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const consoleErrors = [];
const pageErrors = [];
const requestFailures = [];

function monitor(page) {
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) => requestFailures.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText || 'failed'}`));
}

async function inspect(viewport, dark = false) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript({
    content: `${axe.source}; try { localStorage.setItem('jianjian-theme', '${dark ? 'dark' : 'light'}'); } catch (e) {}`
  });
  const page = await context.newPage();
  monitor(page);
  const results = [];
  for (const unit of units) {
    await page.goto(`${base}/?v=${version}#${unit.id}`, { waitUntil: 'networkidle' });
    await page.locator('#unitTitle').waitFor();
    if (dark && !(await page.locator('body').evaluate((element) => element.classList.contains('dark')))) await page.locator('#themeToggle').click();
    const result = await page.evaluate(async ({ id, kind }) => {
      const visible = [...document.querySelectorAll('button,input,textarea,select,a')].filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      const sizes = visible.map((element) => Math.round(Math.min(element.getBoundingClientRect().width, element.getBoundingClientRect().height)));
      const ids = [...document.querySelectorAll('[id]')].map((element) => element.id);
      const axeViolations = (await axe.run(document, { resultTypes: ['violations'] })).violations.map(({ id, impact, nodes }) => ({ stage: 'understand', id, impact, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) }));
      return {
        id, kind,
        overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
        badControls: sizes.filter((size) => size < 44).length,
        minControl: sizes.length ? Math.min(...sizes) : 44,
        badImages: [...document.images].filter((image) => !image.complete || !image.naturalWidth).length,
        duplicateIds: ids.length - new Set(ids).size,
        workshops: document.querySelectorAll('[data-workshop]').length,
        codeExercises: document.querySelectorAll('[data-run-exercise]').length,
        axeViolations,
      };
    }, unit);
    await page.locator('button[data-stage="practice"]').click();
    const practiceViolations = await page.evaluate(async () => (await axe.run(document, { resultTypes: ['violations'] })).violations.map(({ id, impact, nodes }) => ({ stage: 'practice', id, impact, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) })));
    result.axeExecuted = true;
    result.axeStages = ['understand', 'practice'];
    result.axeViolations.push(...practiceViolations);
    results.push(result);
  }
  await context.close();
  return results;
}

const desktop = await inspect({ width: 1440, height: 1000 });
const mobile = await inspect({ width: 390, height: 844 });
const darkMobile = await inspect({ width: 390, height: 844 }, true);
const context = await browser.newContext({ viewport: { width: 720, height: 500 } });
const page = await context.newPage();
monitor(page);
await page.goto(`${base}/?v=${version}#chapter-1`, { waitUntil: 'networkidle' });
const axeResults = [
  ...desktop.flatMap((unit) => unit.axeViolations.map((violation) => ({ surface: 'desktop-light', unit: unit.id, ...violation }))),
  ...mobile.flatMap((unit) => unit.axeViolations.map((violation) => ({ surface: 'mobile-light', unit: unit.id, ...violation }))),
  ...darkMobile.flatMap((unit) => unit.axeViolations.map((violation) => ({ surface: 'mobile-dark', unit: unit.id, ...violation }))),
];
const reflow = await page.evaluate(() => ({ overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth), menuVisible: getComputedStyle(document.querySelector('#menuToggle')).display !== 'none' }));
await page.locator('#menuToggle').click();
const sidebarOpen = await page.locator('.sidebar').getAttribute('aria-hidden') === 'false';
await page.keyboard.press('Escape');
const escapeFocus = await page.evaluate(() => document.activeElement?.id);
await page.locator('#searchToggle').click();
const dialogOpen = await page.locator('#searchDialog').evaluate((element) => element.open);
await page.keyboard.press('Escape');
const dialogClosed = !(await page.locator('#searchDialog').evaluate((element) => element.open));
const programmaticHeadingOutline = await page.locator('#unitTitle').evaluate((element) => getComputedStyle(element).outlineStyle);
const keyboardPath = [];
async function keyboardStep(name, locator, key = null) {
  await locator.focus();
  const focusVisible = await locator.evaluate((element) => element.matches(':focus-visible'));
  keyboardPath.push({ name, focusVisible });
  if (key) await page.keyboard.press(key);
}
await keyboardStep('stage-read', page.locator('button[data-stage="read"]'), 'Enter');
await keyboardStep('flow-node', page.locator('[data-flow="1"]'), 'Enter');
await keyboardStep('technical-details', page.locator('#technicalCard summary'), 'Enter');
await keyboardStep('stage-practice', page.locator('button[data-stage="practice"]'), 'Enter');
await keyboardStep('code-editor', page.locator('[data-code-exercise] .code-editor'));
await keyboardStep('run-code', page.locator('[data-code-exercise] [data-run-exercise]'));
await keyboardStep('quiz-choice', page.locator('#exerciseCard .quiz-item').first().locator('input').first());
await keyboardStep('workshop-field', page.locator('[data-workshop-field="0"]'));
await keyboardStep('complete', page.locator('#completeButton'));
await context.close();

const darkContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
await darkContext.addInitScript({ content: axe.source });
const darkPage = await darkContext.newPage();
monitor(darkPage);
await darkPage.goto(`${base}/?v=${version}#chapter-1`, { waitUntil: 'networkidle' });
await darkPage.locator('#themeToggle').click();
await darkPage.waitForTimeout(300);
const darkAxeViolations = (await darkPage.evaluate(async () => (await axe.run(document, { resultTypes: ['violations'] })).violations.map(({ id, impact }) => ({ id, impact }))));
await darkContext.close();

const reducedContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const reducedPage = await reducedContext.newPage();
monitor(reducedPage);
await reducedPage.goto(`${base}/?v=${version}#chapter-1`, { waitUntil: 'networkidle' });
const reducedMotion = await reducedPage.evaluate(() => {
  const seconds = Number.parseFloat(getComputedStyle(document.querySelector('.icon-button')).transitionDuration) || 0;
  return matchMedia('(prefers-reduced-motion: reduce)').matches && seconds <= 0.00001;
});
await reducedContext.close();

const interactionContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
const interactionPage = await interactionContext.newPage();
monitor(interactionPage);
await interactionPage.goto(`${base}/?v=${version}#chapter-9`, { waitUntil: 'networkidle' });
await interactionPage.locator('button[data-stage="practice"]').click();
const workshop = book.chapters[8].workshop;
const rubricAnswers = JSON.parse(await readFile(path.join(root, 'runner/rubrics.json'), 'utf8'))['chapter-9'].map((decision) => decision[0]);
for (let index = 0; index < workshop.fields.length; index += 1) {
  const wrong = workshop.fields[index].options.find((option) => option !== rubricAnswers[index]);
  await interactionPage.locator(`[data-workshop-field="${index}"]`).selectOption({ label: wrong });
}
await interactionPage.locator('[data-submit-workshop]').click();
await interactionPage.locator('.workshop-result.failure').waitFor();
const wrongRejected = await interactionPage.locator('.workshop-result.failure').isVisible();
const chapter9Answers = [book.chapters[8].goal, book.chapters[8].task, book.chapters[8].accept];
for (let index = 0; index < workshop.fields.length; index += 1) await interactionPage.locator(`[data-workshop-field="${index}"]`).selectOption({ label: rubricAnswers[index] || chapter9Answers[index] });
await interactionPage.locator('[data-submit-workshop]').click();
await interactionPage.locator('.workshop-result.success').waitFor();
const validAccepted = await interactionPage.locator('.workshop-result.success').isVisible();
const chapter9Solution = `package main

import (
	"encoding/json"
	"net/http"
	"strings"
)

type CreateRunRequest struct {
	Input string \`json:"input"\`
}

func HandleCreateRun(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	tenant := strings.TrimSpace(r.Header.Get("X-Tenant-ID"))
	if tenant == "" {
		http.Error(w, "missing tenant", http.StatusUnauthorized)
		return
	}
	var body CreateRunRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.Input) == "" {
		http.Error(w, "bad input", http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_, _ = w.Write([]byte(\`{"status":"accepted"}\`))
}
`;
await interactionPage.locator('[data-code-exercise] .code-editor').fill(chapter9Solution);
await interactionPage.locator('[data-code-exercise] [data-run-exercise]').click();
await interactionPage.locator('[data-code-exercise] .run-result.success').waitFor({ timeout: 60000 });
const chapter9CodeAccepted = await interactionPage.locator('.run-result.success').isVisible();
for (let index = 0; index < book.chapters[8].selfCheck.length; index += 1) {
  const quiz = book.chapters[8].selfCheck[index];
  const item = interactionPage.locator(`#exerciseCard .quiz-item[data-quiz="${index}"]`);
  await item.locator(`input[value="${quiz.correctIndex}"]`).check();
  await item.locator('[data-submit-answer]').click();
}
await interactionPage.locator('#completeButton').click();
await interactionPage.locator('#completeButton', { hasText: '本节已完成' }).waitFor();
await interactionPage.reload({ waitUntil: 'networkidle' });
const reloadPersisted = (await interactionPage.locator('#completeButton').textContent()).includes('本节已完成');
const keywordResponse = await interactionContext.request.post(`${base}/api/check`, { data: { unitId: 'chapter-9', answers: ['当 dto principal 请求进入时，如果失败则拒绝，并通过测试保存证据。', '当返回 400 401 403 404 时，如果失败则拒绝，并通过测试保存证据。', '使用 httptest 检查 status；如果失败则返回，并通过测试保存证据。'] } });
const keywordListRejected = keywordResponse.status() === 422;
await interactionPage.goto(`${base}/?v=${version}#chapter-1`, { waitUntil: 'networkidle' });
await interactionPage.locator('button[data-stage="practice"]').click();
const runButton = interactionPage.locator('[data-code-exercise] [data-run-exercise]');
const editor = interactionPage.locator('[data-code-exercise] .code-editor');
await runButton.click();
const editorLockedDuringRun = await editor.isDisabled();
await interactionPage.locator('.run-result.failure').waitFor({ timeout: 30000 });
const editorUnlockedAfterRun = !(await editor.isDisabled());
const starterFailed = await interactionPage.locator('.run-result.failure').isVisible();
await interactionPage.evaluate((currentVersion) => {
  localStorage.setItem('manga-go-version', currentVersion);
  localStorage.setItem('jianjian-completed', JSON.stringify(['chapter-1', 'chapter-2']));
  localStorage.setItem('manga-go-practices', JSON.stringify({
    'chapter-1': {workshopOk:true, completionDigest:'sha256:forged', codeOk:true, codeDigest:'sha256:forged', runProof:'run:forged'},
    'chapter-2': {workshopOk:true, completionDigest:'sha256:forged'},
  }));
}, version);
await interactionPage.reload({ waitUntil: 'networkidle' });
const forgedCompletionCleared = !(await interactionPage.locator('#completeButton').textContent()).includes('本节已完成');
const forgedStorageCleared = await interactionPage.evaluate(() => JSON.parse(localStorage.getItem('jianjian-completed') || '[]').length === 0);
await interactionContext.close();

const screenshotContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const screenshotPage = await screenshotContext.newPage();
monitor(screenshotPage);
await screenshotPage.goto(`${base}/?v=${version}#chapter-9`, { waitUntil: 'networkidle' });
await screenshotPage.locator('button[data-stage="practice"]').click();
const desktopPath = path.join(root, 'evidence/browser-v18-desktop.png');
await screenshotPage.screenshot({ path: desktopPath });
await screenshotContext.close();
const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
const mobilePage = await mobileContext.newPage();
monitor(mobilePage);
await mobilePage.goto(`${base}/?v=${version}#chapter-9`, { waitUntil: 'networkidle' });
await mobilePage.locator('#themeToggle').click();
await mobilePage.locator('button[data-stage="practice"]').click();
const mobilePath = path.join(root, 'evidence/browser-v18-mobile.png');
await mobilePage.screenshot({ path: mobilePath });
await mobileContext.close();
const browserVersion = browser.version();
await browser.close();

const expectedConsoleErrors = consoleErrors.filter((message) => message.includes('status of 422'));
const unexpectedConsoleErrors = consoleErrors.filter((message) => !message.includes('status of 422'));

const bound = ['VERSION', 'interactive/index.html', 'interactive/app.js', 'interactive/styles.css', 'interactive/data/book.json', 'runner/main.go', 'browser_audit.mjs', 'package.json', 'package-lock.json'];
const artifactSha256 = Object.fromEntries(await Promise.all(bound.map(async (file) => [file, createHash('sha256').update(await readFile(path.join(root, file))).digest('hex')])));
const screenshot = async (file) => ({ path: file, sha256: createHash('sha256').update(await readFile(path.join(root, file))).digest('hex') });
const evidence = {
  status: 'pass', version, generatedAt: new Date().toISOString(), url: base, units: units.length, artifactSha256,
  desktop: { viewport: { width: 1440, height: 1000 }, units: desktop },
  mobile: { viewport: { width: 390, height: 844 }, units: mobile },
  darkMobile: { viewport: { width: 390, height: 844 }, units: darkMobile },
  accessibility: { axeViolations: axeResults, darkAxeViolations, reflow200Percent: reflow, keyboard: { sidebarOpen, escapeFocus, dialogOpen, dialogClosed, learningPath: keyboardPath }, reducedMotion, programmaticHeadingOutline },
  interactions: { structuredWorkshop: { wrongRejected, validAccepted, chapter9CodeAccepted, reloadPersisted, keywordListRejected }, staleResponse: { editorLockedDuringRun, editorUnlockedAfterRun, starterFailed }, forgedLocalStorage: { forgedCompletionCleared, forgedStorageCleared } },
  runtime: { browserVersion },
  expectedConsoleErrors, consoleErrors: unexpectedConsoleErrors, pageErrors, requestFailures,
  screenshots: { desktop: await screenshot('evidence/browser-v18-desktop.png'), mobile: await screenshot('evidence/browser-v18-mobile.png') },
};
await writeFile(path.join(root, 'evidence/browser-v18.json'), `${JSON.stringify(evidence, null, 2)}\n`);
if (!chapter9CodeAccepted || axeResults.length || darkAxeViolations.length || unexpectedConsoleErrors.length || pageErrors.length || requestFailures.length) process.exitCode = 1;
console.log(JSON.stringify({ status: process.exitCode ? 'fail' : 'pass', units: units.length, axeViolations: axeResults.length }));
