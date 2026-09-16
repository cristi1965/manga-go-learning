import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';

const base = process.env.MANGA_GO_URL || 'http://127.0.0.1:4173';
const book = JSON.parse(await readFile(new URL('./interactive/data/book.json', import.meta.url), 'utf8'));
const expectedSupplements = book.chapters.reduce((sum, chapter) => sum + chapter.supplements.length, 0);
const projectSolution = process.env.MANGA_GO_PROJECT_SOLUTION || `//go:build learner01

package ledgeragent

import (
  "context"
  "time"
)

func invokeProvider(parent context.Context, provider Provider, timeout time.Duration, req ProviderRequest) ([]byte, error) {
  ctx, cancel := context.WithTimeout(parent, timeout)
  defer cancel()
  body, err := provider.Decide(ctx, req)
  if err != nil { return nil, err }
  if err := ctx.Err(); err != nil { return nil, err }
  return body, nil
}`;
const errors = [];
const apiTrace = [];
const browser = await chromium.launch({ channel: 'chrome', headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', async (response) => {
    if (response.url().includes('/api/')) apiTrace.push({ status: response.status(), url: response.url(), body: await response.text() });
  });
  await page.goto(`${base}/#supplement-go-ai-01`, { waitUntil: 'networkidle' });
  const title = await page.locator('#unitTitle').textContent();
  if (!title?.includes('模型适配器')) throw new Error(`supplement did not render: ${title}`);

  await page.locator('button[data-stage="practice"]').click();
  const practiceTop = await page.locator('#exerciseCard').evaluate((element) => element.getBoundingClientRect().top);
  if (practiceTop >= 720) throw new Error(`practice remains below viewport: ${practiceTop}`);

  const stats = await page.locator('#statSupplements').textContent();
  if (Number(stats) !== expectedSupplements) throw new Error(`supplement stats ${stats} != ${expectedSupplements}`);

  const run = await fetch(`${base}/api/run`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ unitId: 'ledger-agent-lab/provider', code: '' }) });
  const runBody = await run.json();
  if (run.status !== 422 || runBody.ok) throw new Error(`empty project code bypassed integration gate: ${run.status} ${JSON.stringify(runBody)}`);

  const firstMilestone = book.chapters[15].supplements.find((unit) => unit.id === 'supplement-go-ai-01');
  const editor = page.locator('#exerciseCard .code-editor');
  await editor.fill(projectSolution);
  await page.locator('[data-run-exercise]').click();
  await page.locator('[data-code-exercise] .run-result.success').waitFor({ timeout: 60000 });
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('manga-go-practices') || '{}')['supplement-go-ai-01']?.codeOk === true);
  const quiz = page.locator('#exerciseCard .quiz-item').first();
  await quiz.locator(`input[value="${firstMilestone.selfCheck[0].correctIndex}"]`).check();
  await quiz.locator('[data-submit-answer]').click();
  await page.locator('[data-run-project]').click();
  await page.locator('[data-project-lab] .run-result.success').waitFor({ timeout: 70000 });
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('manga-go-practices') || '{}')['supplement-go-ai-01']?.labOk === true);
  await page.locator('#completeButton').click();
  await page.waitForFunction(() => document.querySelector('#completeButton')?.textContent.includes('已完成'), null, { timeout: 5000 }).catch(() => {});
  if (!(await page.locator('#completeButton').textContent()).includes('已完成')) {
    const practice = await page.evaluate(() => JSON.parse(localStorage.getItem('manga-go-practices') || '{}')['supplement-go-ai-01']);
    throw new Error(`project milestone did not complete: ${JSON.stringify({ practice, apiTrace })}`);
  }
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('button[data-stage="practice"]').click();
  if (!(await page.locator('#completeButton').textContent()).includes('已完成')) throw new Error('supplement completion did not survive reload');

  const staleProof = 'runner-proof-lost-after-restart';
  await page.evaluate((value) => {
    const practices = JSON.parse(localStorage.getItem('manga-go-practices') || '{}');
    const practice = practices['supplement-go-ai-01'];
    practice.runProof = value;
    practice.labRunProof = value;
    practice.completionDigest = value;
    localStorage.setItem('manga-go-practices', JSON.stringify(practices));
  }, staleProof);
  await page.reload({ waitUntil: 'domcontentloaded' });
  if (!(await page.locator('#completeButton').textContent()).includes('已完成')) throw new Error('background proof recovery blocked or flashed away local completion');
  await page.waitForFunction((value) => {
    const practice = JSON.parse(localStorage.getItem('manga-go-practices') || '{}')['supplement-go-ai-01'];
    return practice?.runProof && practice.runProof !== value && practice?.labRunProof && practice.labRunProof !== value && practice?.completionDigest && practice.completionDigest !== value;
  }, staleProof, { timeout: 130000 });
  if (!(await page.locator('#completeButton').textContent()).includes('已完成')) throw new Error('supplement completion was lost after proof recovery');

  await page.locator('#nextButton').click();
  if (!(await page.locator('#unitTitle').textContent()).includes('结构化决策')) throw new Error('flattened next navigation skipped the adjacent milestone');
  await page.locator('button[data-stage="practice"]').click();

  const draftMarker = '\n// draft-survives-reload';
  const nextEditor = page.locator('#exerciseCard .code-editor');
  await nextEditor.fill((await nextEditor.inputValue()) + draftMarker);
  await page.reload({ waitUntil: 'networkidle' });
  if (!(await nextEditor.inputValue()).includes(draftMarker)) throw new Error('code draft did not survive reload');

  await page.locator('.brand').click();
  if (!(await page.locator('#welcome').isVisible())) throw new Error('brand did not return home');
  await page.locator('#continueButton').click();
  if (!(await page.locator('#unitTitle').textContent()).includes('结构化决策') || !(await page.locator('#exerciseCard').isVisible())) throw new Error('continue did not restore the exact unit and stage');
  if (errors.length) throw new Error(`page errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({ status: 'pass', expectedSupplements, labProof: true }));
} finally {
  await browser.close();
}
