import {chromium} from 'playwright';
const browser=await chromium.launch({channel:'chrome',headless:true});
for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:950}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/#chapter-1');
 await page.locator('[data-stage="practice"]').click();
 const editor=page.locator('#exerciseCard .code-editor');await editor.waitFor();
 const orig=await editor.inputValue();await editor.fill(orig+'\n// 输入高亮检查');
 if(!(await page.locator('.code-backdrop .comment').allTextContents()).some(t=>t.includes('输入高亮检查')))throw Error('input not synced');
 await page.locator('[data-reset-exercise]').click();
 if(await editor.inputValue()!==orig)throw Error('reset failed');
 const metrics=await editor.evaluate(e=>{const b=e.previousElementSibling;let x=getComputedStyle(e),y=getComputedStyle(b);return [x.font===y.font,x.padding===y.padding,x.color, b.querySelector('.kw')&&getComputedStyle(b.querySelector('.kw')).color]});
 if(!metrics[0]||!metrics[1]||!metrics[3])throw Error('layer mismatch '+metrics);
 await editor.evaluate(e=>{e.scrollLeft=180;e.scrollTop=70;e.dispatchEvent(new Event('scroll'))});
 const aligned=await editor.evaluate(e=>e.scrollLeft===e.previousElementSibling.scrollLeft&&e.scrollTop===e.previousElementSibling.scrollTop);
 if(!aligned)throw Error('scroll drift');
 await editor.evaluate(e=>{e.scrollLeft=0;e.scrollTop=0;e.dispatchEvent(new Event('scroll'))});
 for(const el of await page.locator('.exercise-hints summary').all())await el.click();
 await editor.scrollIntoViewIfNeeded();
 await page.screenshot({path:`evidence/editor-style-${width}.png`});
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw Error('overflow');
 if(errors.length)throw Error(errors.join(','));
 console.log('PASS',width,metrics);await page.close();
}
await browser.close();
