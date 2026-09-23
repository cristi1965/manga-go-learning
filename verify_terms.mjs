import {chromium} from 'playwright';
import {termDefinitions} from './interactive/term-definitions.js';
import {writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const browser=await chromium.launch({channel:'chrome',headless:true});const checks=[],errors=[];
for(const width of [1440,390])for(const dark of [false,true]){
 const page=await browser.newPage({viewport:{width,height:950}});page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(v=>localStorage.setItem('jianjian-theme',v?'dark':'light'),dark);
 await page.goto('http://127.0.0.1:4173/#chapter-10');await page.locator('#technicalCard .term-trigger').first().waitFor();
 for(const name of ['Handler','Service','Repository','composition root','SQLRepository','FakeRepository','Gin Context']){
  const target=page.locator('#technicalCard .term-trigger').filter({hasText:new RegExp('^'+name+'$')}).first();
  await target.scrollIntoViewIfNeeded();await page.waitForTimeout(500);await target.hover();if(!await page.locator('#termTooltip').isVisible())throw Error('hover '+name);
  await target.click();await page.locator('.term-dialog[open]').waitFor();
  const text=await page.locator('.term-dialog').innerText();if(!text.includes('容易误解')||!text.includes('例子'))throw Error('incomplete '+name);
  if(await page.locator('.term-dialog').evaluate(e=>e.scrollWidth>e.clientWidth+1))throw Error('dialog overflow');
  if(name==='Repository')await page.screenshot({path:`evidence/terms-${width}-${dark?'dark':'light'}.png`});
  await page.keyboard.press('Escape');if(await page.locator('.term-dialog').evaluate(e=>e.open))throw Error('escape');
 }
 const count=await page.locator('.term-trigger').count();await page.reload();await page.locator('#technicalCard .term-trigger').first().waitFor();if(count!==await page.locator('.term-trigger').count())throw Error('duplicate wrappers');
 await page.locator('#technicalCard .term-trigger').first().focus();await page.keyboard.press('Enter');if(!await page.locator('.term-dialog').evaluate(e=>e.open))throw Error('keyboard');await page.keyboard.press('Escape');
 await page.locator('button[data-stage="practice"]').click();if(await page.locator('.cm-host .term-trigger').count())throw Error('editor mutated');
 checks.push({width,dark,hover:true,click:true,keyboard:true,noEditorMutation:true});await page.close();
}
await browser.close();const hashes={};for(const p of ['interactive/term-help.js','interactive/term-definitions.js'])hashes[p]=createHash('sha256').update(await readFile(p)).digest('hex');
await writeFile('evidence/terms.json',JSON.stringify({definitions:termDefinitions.length,hashes,checks,errors},null,2));if(errors.length)throw Error(errors.join('\n'));console.log({definitions:termDefinitions.length,checks});
