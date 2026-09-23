import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const book=JSON.parse(await readFile('interactive/data/book.json','utf8'));
const units=book.chapters.flatMap(c=>[c,...c.supplements]);
const browser=await chromium.launch({channel:'chrome',headless:true});
const errors=[],results=[];
for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:950}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/#chapter-1');await page.locator('#unitTitle').waitFor();
 for(const unit of units){
  await page.evaluate(id=>{location.hash=id},unit.id);
  await page.waitForFunction(id=>document.querySelector('#comicOpening blockquote')&&location.hash===`#${id}`&&document.querySelector('#unitTitle').textContent.includes(id.startsWith('chapter-')?'': ''),unit.id);
  // The application's hash handler opens the unit synchronously on hashchange.
  await page.waitForFunction(text=>document.querySelector('#comicOpening blockquote')?.textContent===text,unit.dialogue[0].text);
  await page.locator('.story-extra').evaluate((details) => { details.open = true; });
  const actual=[...await page.locator('#comicOpening blockquote').allTextContents(),...await page.locator('#chatCard .bubble').allTextContents()];
  if(JSON.stringify(actual)!==JSON.stringify(unit.dialogue.map(t=>t.text.replace(/`([^`\n]+)`/g,'$1'))))throw Error('dialogue mismatch '+unit.id);
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw Error('overflow '+unit.id+' '+width);
  if(['chapter-1','supplement-go-real-test-file','supplement-go-ai-01'].includes(unit.id)){
   await page.locator('.story-extra').scrollIntoViewIfNeeded();await page.screenshot({path:`evidence/dialogue-${unit.id}-${width}.png`});
  }
  results.push({id:unit.id,width,turns:actual.length});
 }
 await page.close();
}
await browser.close();
const hashes={};for(const p of ['interactive/data/book.json','interactive/app.js','interactive/styles.css'])hashes[p]=createHash('sha256').update(await readFile(p)).digest('hex');
await writeFile('evidence/dialogue-rewrite-browser.json',JSON.stringify({hashes,results,errors},null,2));
if(errors.length)throw Error(errors.join('\n'));console.log(`PASS ${results.length} unit/viewports`);
