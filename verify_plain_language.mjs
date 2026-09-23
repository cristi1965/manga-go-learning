import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const book=JSON.parse(await readFile('interactive/data/book.json','utf8'));
const units=book.chapters.flatMap(c=>[c,...c.supplements]);
const browser=await chromium.launch({channel:'chrome',headless:true});
const checks=[],errors=[];
for(const width of [1440,390]) {
 const page=await browser.newPage({viewport:{width,height:950}});
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/#chapter-1');
 for(const unit of units){
  await page.evaluate(id=>location.hash=id,unit.id);
  const title=unit.kind==='chapter'?unit.shortTitle:`${unit.projectLab?'项目里程碑':'参考补页'} · ${unit.title}`;
  await page.waitForFunction(title=>document.querySelector('#unitTitle')?.textContent===title,title);
  for(const stage of ['understand','read','practice']){
   const button=page.locator(`button[data-stage="${stage}"]`);
   if(await button.count())await button.click();
  }
  const labels=await page.locator('#exerciseCard .quiz-list label span').allTextContents();
  const expected=(unit.selfCheck||[]).flatMap(q=>q.choiceLabels||q.choices);
  const normalize=t=>t.replace(/`/g,'');
  if(JSON.stringify(labels.map(normalize))!==JSON.stringify(expected.map(normalize)))throw Error('quiz labels '+unit.id);
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw Error('overflow '+unit.id);
  checks.push({id:unit.id,width,labels:labels.length});
 }
 await page.goto('http://127.0.0.1:4173/#chapter-19');
 await page.locator('#incidentCard').waitFor();
 await page.screenshot({path:`evidence/plain-language-${width}.png`});
 await page.close();
}
await browser.close();
if(errors.length)throw Error(errors.join('\n'));
const hashes={};
for(const file of ['interactive/data/book.json','interactive/app.js','interactive/lesson-briefs.js','interactive/term-definitions.js'])hashes[file]=createHash('sha256').update(await readFile(file)).digest('hex');
await writeFile('evidence/plain-language-browser.json',JSON.stringify({hashes,checks,errors},null,2));
console.log(`PASS ${checks.length} unit/viewports; display labels match source`);
