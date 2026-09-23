import { chromium } from 'playwright';

const browser = await chromium.launch({channel: 'chrome', headless: true});
const errors = [];
for (const width of [1440, 390]) {
  const page = await browser.newPage({viewport: {width, height: 900}});
  const apiRequests = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url());
  });
  page.on('pageerror', (error) => errors.push(`${width}: ${error.message}`));
  await page.goto('http://127.0.0.1:4173/?static=1#chapter-1', {waitUntil: 'networkidle'});
  await page.waitForSelector('#overviewDiagram svg');
  if (!(await page.locator('#hostingNotice').isVisible())) errors.push(`${width}: hosting notice hidden`);
  if (await page.locator('.local-only').isVisible()) errors.push(`${width}: local link visible`);
  await page.locator('button[data-stage="read"]').click();
  await page.locator('.full-code').first().evaluate((node) => { node.open = true; });
  await page.locator('[data-run-unit]').first().click();
  if (!(await page.locator('#toast').textContent()).includes('在线版不执行服务器代码')) errors.push(`${width}: static run notice missing`);
  if (apiRequests.length) errors.push(`${width}: requested ${apiRequests.join(', ')}`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (overflow) errors.push(`${width}: document overflow`);
  await page.close();
}
await browser.close();
if (errors.length) {
  console.error(JSON.stringify(errors, null, 2));
  process.exit(1);
}
console.log('PASS GitHub Pages static mode');
