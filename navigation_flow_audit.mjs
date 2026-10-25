import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';

const base = process.env.MANGA_GO_URL || 'http://127.0.0.1:4173';
const book = JSON.parse(await readFile(new URL('./interactive/data/book.json', import.meta.url), 'utf8'));
const database = JSON.parse(await readFile(new URL('./interactive/data/database_curriculum.json', import.meta.url), 'utf8'));
const browser = await chromium.launch({channel: 'chrome', headless: true});
const failures = [];

const expect = (condition, message) => { if (!condition) failures.push(message); };

async function freshPage(viewport = {width: 1440, height: 900}) {
  const context = await browser.newContext({viewport, reducedMotion: 'reduce'});
  const page = await context.newPage();
  await page.goto(`${base}/#top`, {waitUntil: 'networkidle'});
  return {page, context};
}

async function expectGoTarget(page, selector, expected, label) {
  const control = page.locator(selector).first();
  await control.scrollIntoViewIfNeeded();
  await control.click();
  await page.waitForTimeout(80);
  const actual = await page.locator('#unitView').getAttribute('data-unit-id');
  expect(actual === expected, `${label}: expected ${expected}, got ${actual || 'no unit'}`);
  expect(new URL(page.url()).hash === `#${expected}`, `${label}: hash did not become #${expected}`);
}

try {
  const {page, context} = await freshPage();
  const homeCases = [
    ['.learning-paths [data-start-chapter="1"]', 'chapter-1', 'Go route'],
    ['.learning-paths [data-start-chapter="9"]', 'chapter-9', 'backend route'],
    ['.learning-paths [data-start-chapter="17"]', 'chapter-17', 'Agent route'],
    ['.learning-paths [data-start-chapter="20"]', 'chapter-20', 'advanced Agent route'],
  ];
  for (const [selector, expected, label] of homeCases) {
    await page.goto(`${base}/#top`, {waitUntil: 'networkidle'});
    await expectGoTarget(page, selector, expected, label);
  }
  await page.goto(`${base}/#top`, {waitUntil: 'networkidle'});
  expect(await page.locator('.agent-project-link').count() === 0, 'Agent overview still contains competing deep-link buttons');

  await page.goto(`${base}/#top`, {waitUntil: 'networkidle'});
  await expectGoTarget(page, '[data-start-wails]', 'chapter-2', 'Wails route');
  expect(await page.evaluate(() => localStorage.getItem('manga-go-route-mode')) === 'wails', 'Wails route mode was not persisted');

  const databaseCases = [
    ['database', 'db-01'], ['mysql', 'mysql-01'], ['redis', 'redis-01'],
  ];
  for (const [track, expected] of databaseCases) {
    await page.goto(`${base}/#top`, {waitUntil: 'networkidle'});
    await page.locator(`[data-start-database="${track}"]`).click();
    await page.waitForTimeout(50);
    expect(new URL(page.url()).hash === `#${expected}`, `${track} route did not open ${expected}`);
  }

  await page.goto(`${base}/#chapter-4`, {waitUntil: 'networkidle'});
  expect(await page.locator('[data-lesson-anchor]').count() === 0, 'legacy five-step anchors are still interactive');
  const lessonTaskCount = await page.locator('[data-lesson-task]').count();
  expect(lessonTaskCount === 3, 'lesson does not expose exactly three stable tasks');
  const taskButtons = page.locator('[data-lesson-task]');
  for (let index = 0; index < lessonTaskCount; index += 1) {
    const before = await page.evaluate(() => scrollY);
    await taskButtons.nth(index).click();
    await page.waitForTimeout(30);
    const after = await page.evaluate(() => scrollY);
    expect(Math.abs(after - before) <= 8, `task ${index + 1} moved scroll by ${after - before}px`);
  }
  const hashBeforeCompletion = new URL(page.url()).hash;
  await page.locator('#completeButton').scrollIntoViewIfNeeded();
  const scrollBeforeCompletion = await page.evaluate(() => scrollY);
  await page.locator('#completeButton').click();
  await page.waitForTimeout(50);
  const scrollAfterCompletion = await page.evaluate(() => scrollY);
  expect(Math.abs(scrollAfterCompletion - scrollBeforeCompletion) <= 8, `completion check moved scroll by ${scrollAfterCompletion - scrollBeforeCompletion}px`);
  expect(new URL(page.url()).hash === hashBeforeCompletion, 'completion check changed the route');
  await page.goto(`${base}/#chapter-1`, {waitUntil: 'networkidle'});
  await page.locator('[data-lesson-task="practice"]').click();
  await page.locator('#supplementList').scrollIntoViewIfNeeded();
  await page.locator('#supplementList [data-supplement]').first().click();
  await page.locator('#unitView[data-ready="true"]').waitFor();
  expect(await page.evaluate(() => scrollY) <= 8, 'supplement did not open at the lesson start');

  // Cross-unit navigation never requires completion evidence.
  await page.goto(`${base}/#chapter-4`, {waitUntil: 'networkidle'});
  await page.locator('#nextButton').click();
  await page.locator('#unitView[data-unit-id="chapter-5"]').waitFor();
  expect(new URL(page.url()).hash === '#chapter-5', 'next lesson was blocked by incomplete requirements');

  // Search resets a persisted Wails route and includes database lessons.
  await page.goto(`${base}/#top`, {waitUntil: 'networkidle'});
  await page.locator('[data-start-wails]').click();
  await page.locator('#searchToggle').click();
  await page.locator('#searchInput').fill('chapter-20');
  await page.locator('#searchResults [data-unit="chapter-20"]').click();
  expect((await page.locator('#nextButton').getAttribute('title'))?.includes('第 21 章'), 'Wails mode polluted search navigation');
  await page.locator('#searchToggle').click();
  await page.locator('#searchInput').fill('mysql-09');
  expect(await page.locator('[data-database-result="mysql-09"]').count() === 1, 'database lesson is missing from global search');
  await page.locator('[data-database-result="mysql-09"]').click();
  expect(new URL(page.url()).hash === '#mysql-09', 'database search result did not open mysql-09');
  await page.locator('#databaseNext').click();
  await page.locator('#unitView[data-unit-id="chapter-11"]').waitFor();
  expect((await page.locator('#nextButton').getAttribute('title'))?.includes('第 12 章'), 'database bridge retained an unrelated route mode');

  await page.goto(`${base}/#top`, {waitUntil: 'networkidle'});
  await page.locator('[data-start-wails]').click();
  await page.goto(`${base}/#chapter-20`, {waitUntil: 'networkidle'});
  await page.locator('#unitView[data-ready="true"][data-unit-id="chapter-20"]').waitFor();
  expect((await page.locator('#nextButton').getAttribute('title'))?.includes('第 21 章'), 'direct hash retained an unrelated Wails route mode');

  await page.goto(`${base}/#db-06`, {waitUntil: 'networkidle'});
  await page.locator('#databaseNext').click();
  expect(new URL(page.url()).hash === '#mysql-01', 'database foundation did not bridge to mysql-01');

  // A supplement opened from search must return to its real parent, not a stale origin.
  await page.goto(`${base}/#chapter-4`, {waitUntil: 'networkidle'});
  await page.locator('[data-lesson-task="practice"]').click();
  await page.locator('#supplementList [data-supplement]').first().click();
  await page.locator('#searchToggle').click();
  await page.locator('#searchInput').fill('chapter-5');
  await page.locator('#searchResults [data-unit="chapter-5"]').click();
  const chapter5Supplement = book.chapters.find((chapter) => chapter.id === 'chapter-5').supplements[0].id;
  await page.locator('#searchToggle').click();
  await page.locator('#searchInput').fill(chapter5Supplement);
  await page.locator(`#searchResults [data-unit="${chapter5Supplement}"]`).click();
  await page.locator('[data-return-chapter="chapter-5"]').click();
  expect(new URL(page.url()).hash === '#chapter-5', 'supplement return used a stale chapter origin');

  const allGoUnits = book.chapters.flatMap((chapter) => [chapter, ...chapter.supplements]);
  for (const unit of allGoUnits) {
    if (unit.kind !== 'chapter' && !unit.projectLab) {
      const parent = book.chapters.find((chapter) => chapter.supplements.some((item) => item.id === unit.id));
      await page.goto(`${base}/#${parent.id}`, {waitUntil: 'networkidle'});
    }
    const button = page.locator(`[data-unit="${unit.id}"]`).first();
    if (!(await button.count())) {
      failures.push(`directory missing ${unit.id}`);
      continue;
    }
    await button.click();
    await page.locator(`#unitView[data-ready="true"][data-unit-id="${unit.id}"]`).waitFor();
    expect(new URL(page.url()).hash === `#${unit.id}`, `directory hash mismatch for ${unit.id}`);
    const expectedTitle = unit.kind === 'chapter' ? unit.shortTitle : `${unit.projectLab ? '项目里程碑' : '参考补页'} · ${unit.title}`;
    expect((await page.locator('#unitTitle').textContent())?.trim() === expectedTitle, `directory title mismatch for ${unit.id}`);
    expect(await page.locator(`[data-unit="${unit.id}"].active`).count() >= 1, `directory active item mismatch for ${unit.id}`);
    expect(await page.evaluate(() => scrollY) <= 8, `directory did not open ${unit.id} at the lesson start`);
  }

  await page.goto(`${base}/#db-01`, {waitUntil: 'networkidle'});
  const databaseUnits = database.tracks.flatMap((track) => track.units);
  for (const unit of databaseUnits) {
    const button = page.locator(`[data-database-unit="${unit.id}"]`).first();
    if (!(await button.count())) {
      failures.push(`database directory missing ${unit.id}`);
      continue;
    }
    await button.click();
    expect(new URL(page.url()).hash === `#${unit.id}`, `database directory hash mismatch for ${unit.id}`);
    expect((await page.locator('#databaseUnitTitle').textContent())?.trim() === unit.title, `database title mismatch for ${unit.id}`);
    expect(await page.locator(`[data-database-unit="${unit.id}"].active`).count() === 1, `database active item mismatch for ${unit.id}`);
  }

  const cleanContext = await browser.newContext({viewport: {width: 1440, height: 900}, reducedMotion: 'reduce'});
  const cleanPage = await cleanContext.newPage();
  await cleanPage.goto(`${base}/#top`, {waitUntil: 'networkidle'});
  await cleanPage.evaluate(() => localStorage.clear());
  await cleanPage.reload({waitUntil: 'networkidle'});
  await cleanPage.locator('[data-start-database="redis"]').click();
  await cleanPage.locator('.brand').click();
  expect(await cleanPage.locator('#continueButton').isVisible(), 'continue learning stayed hidden after first database visit');
  await cleanPage.locator('#continueButton').click();
  expect(new URL(cleanPage.url()).hash === '#redis-01', 'continue learning did not restore the database unit');
  await cleanContext.close();

  const mobileContext = await browser.newContext({viewport: {width: 390, height: 844}, reducedMotion: 'reduce'});
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(`${base}/#chapter-4`, {waitUntil: 'networkidle'});
  await mobilePage.locator('[data-lesson-task="practice"]').click();
  expect(await mobilePage.locator('#lessonPracticePane').isVisible(), 'mobile practice task did not open the practice pane');
  await mobilePage.locator('[data-lesson-pane="explain"]').click();
  expect(await mobilePage.locator('#lessonExplainPane').isVisible(), 'mobile explain pane could not be selected');
  await mobileContext.close();

  await context.close();
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(JSON.stringify({status: 'fail', failures}, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({status: 'pass', goUnits: book.chapters.flatMap((chapter) => [chapter, ...chapter.supplements]).length, databaseUnits: database.tracks.flatMap((track) => track.units).length, lessonTasks: 3}));
