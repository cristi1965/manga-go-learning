import {chromium} from 'playwright';
import axe from 'axe-core';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
const report={errors:[],checks:[]};
for(const width of [1440,390])for(const dark of [false,true]){
 const page=await browser.newPage({viewport:{width,height:950}});page.on('pageerror',e=>report.errors.push(e.message));
 await page.addInitScript(v=>localStorage.setItem('jianjian-theme',v?'dark':'light'),dark);
 for(const id of ['top','chapter-1','chapter-9','chapter-17','supplement-go-ai-01']){
  await page.goto('http://127.0.0.1:4173/#'+id);await page.locator('#chapterNav button').first().waitFor();await page.addScriptTag({content:axe.source});
  for(const stage of id==='top'?['welcome']:['understand','read','practice']){
   if(stage!=='welcome')await page.locator(`button[data-stage="${stage}"]`).click();
   if(stage==='read'){
    const steps=page.locator('.code-step');if(await steps.count()>1)await steps.nth(1).click();
   }
   if(stage==='practice'){
    const choice=page.locator('.quiz-choices input').first();if(await choice.count())await choice.check();
    const hint=page.locator('.exercise-hints summary').first();if(await hint.count())await hint.click();
   }
   await page.waitForTimeout(300);
   const violations=await page.evaluate(async()=> (await axe.run(document,{runOnly:['color-contrast']})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})));
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
   report.checks.push({width,dark,id,stage,overflow,violations});
   if(id==='chapter-1'&&['read','practice'].includes(stage))await page.screenshot({path:`evidence/theme-${width}-${dark?'dark':'light'}-${stage}.png`});
  }
 }
 await page.close();
}
await browser.close();await writeFile('evidence/theme-audit.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({checks:report.checks.length,errors:report.errors,failures:report.checks.filter(c=>c.overflow||c.violations.length)}));
