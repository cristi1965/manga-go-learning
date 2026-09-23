import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
for (const width of [1440, 390]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.goto('http://127.0.0.1:4173/?v=dialog-comic-check#chapter-19');
  await page.locator('#unitTitle').waitFor();

  const opener = page.locator('#comicOpening');
  if (!await opener.isVisible()) throw new Error(`comic opener hidden at ${width}`);
  if (await opener.locator('.comic-panel').count() !== 2) throw new Error(`comic panel count at ${width}`);
  if (await opener.locator('img').count() !== 2) throw new Error(`comic avatar count at ${width}`);
  if (!await page.locator('#overviewDiagram').isVisible()) throw new Error(`overview diagram at ${width}`);
  const mermaidSvg = page.locator('#overviewDiagram .mermaid-host svg');
  await mermaidSvg.waitFor();
  if (!await mermaidSvg.getAttribute('viewBox')) throw new Error(`mermaid svg at ${width}`);
  if (!await page.locator('#flowCard').isVisible() || await page.locator('#flowCard .flow-node').count() !== 4) throw new Error(`detail flow at ${width}`);
  for (const [chapter, expected] of [['chapter-1', 'Go 学习路线'], ['chapter-9', '后端领域图'], ['chapter-19', 'AI 任务执行与恢复时序']]) {
    await page.evaluate((id) => { location.hash = id; }, chapter);
    await page.waitForFunction((label) => document.querySelector('#overviewDiagram .mermaid-host')?.getAttribute('aria-label') === label, expected);
    await page.locator('#overviewDiagram .mermaid-host svg').waitFor();
    if (await page.locator('#overviewDiagram img').count()) throw new Error(`diagram rendered as image at ${chapter}`);
  }
  await page.locator('#themeToggle').click();
  await page.locator('body.dark #overviewDiagram .mermaid-host svg').waitFor();
  if (await page.locator('#overviewDiagram .diagram-error').count()) throw new Error(`dark diagram at ${width}`);
  await page.locator('#themeToggle').click();
  await page.locator('body:not(.dark) #overviewDiagram .mermaid-host svg').waitFor();
  await page.screenshot({path: `evidence/comic-mermaid-${width}.png`, fullPage: true});

  await page.locator('#progressButton').click();
  const dialog = page.locator('#searchDialog');
  await dialog.waitFor();
  const title = page.locator('#dialogTitle');
  const close = page.locator('#searchDialog [aria-label="关闭"]');
  const [titleBox, closeBox] = await Promise.all([title.boundingBox(), close.boundingBox()]);
  if (!titleBox || !closeBox || Math.abs(titleBox.y - closeBox.y) > 12 || closeBox.x <= titleBox.x) {
    throw new Error(`review header layout at ${width}`);
  }
  if (await close.evaluate((node) => node.matches(':focus-visible'))) throw new Error(`close button auto-focused at ${width}`);
  await page.screenshot({path: `evidence/review-dialog-${width}.png`});
  await page.keyboard.press('Escape');
  await page.close();
}
await browser.close();
console.log('PASS dialog and comic opener');
