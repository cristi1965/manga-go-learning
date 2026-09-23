import {chromium} from 'playwright';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});const checks=[],errors=[];
for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:950}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/#chapter-1');await page.locator('button[data-stage="practice"]').click();
 const input=page.locator('#exerciseCard .cm-content');await input.waitFor();
 const original=await page.locator('#exerciseCard textarea').inputValue();
 await input.fill(original+'\n// 中文输入草稿');
 if(!(await page.locator('#exerciseCard textarea').inputValue()).includes('中文输入草稿'))throw Error('sync');
 await page.reload();await page.locator('button[data-stage="practice"]').click();
 if(!(await input.innerText()).includes('中文输入草稿'))throw Error('draft lost');
 await page.locator('[data-reset-exercise]').click();
 if((await page.locator('#exerciseCard textarea').inputValue())!==original)throw Error('reset');
 await input.click();await page.keyboard.press('ControlOrMeta+End');await page.keyboard.type('x');await page.keyboard.press('ControlOrMeta+z');
 if((await page.locator('#exerciseCard textarea').inputValue())!==original)throw Error('undo');
 await page.locator('#themeToggle').click();if(!await page.locator('#exerciseCard .cm-editor').evaluate(e=>e.classList.contains('cm-editor')&&getComputedStyle(e).backgroundColor==='rgb(40, 44, 52)'))throw Error('dark theme');
 await page.locator('[data-run-exercise]').click();await page.waitForFunction(()=>!document.querySelector('[data-run-exercise]').disabled);
 if(!(await page.locator('#exerciseCard .run-result pre').innerText()).includes('FAIL'))throw Error('unfinished code should fail');
 const solution=original.replace('// TODO: 先检查价格和付款，再返回找零。\n    return 0, nil','if price <= 0 { return 0, ErrInvalidPrice }\n    if paid < price { return 0, ErrInsufficientPayment }\n    return paid - price, nil');
 // Use actual prefix-agnostic replacement because initial indentation may be tabs.
 const fixed=original.replace(/\/\/ TODO:[^\n]*\n\s*return 0, nil/,'if price <= 0 { return 0, ErrInvalidPrice }\n if paid < price { return 0, ErrInsufficientPayment }\n return paid - price, nil');
 await input.fill(fixed);await page.locator('[data-run-exercise]').click();await page.waitForFunction(()=>!document.querySelector('[data-run-exercise]').disabled);
 if(!await page.locator('#exerciseCard .run-result').evaluate(e=>e.classList.contains('success')))throw Error('solution fails');
 await page.screenshot({path:`evidence/codemirror-${width}.png`});
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw Error('overflow');
 await page.goto('http://127.0.0.1:4173/#top');await page.locator('#starterMount .cm-content').waitFor();await page.locator('.starter-run').click();await page.waitForFunction(()=>!document.querySelector('.starter-run').disabled);
 if(!(await page.locator('.starter-output').innerText()).includes('100'))throw Error('starter');
 await page.locator('.starter-next').click();if(await page.locator('#starterMount .cm-editor').count()!==1)throw Error('duplicate editor');
 checks.push({width,draft:true,reset:true,undo:true,dark:true,failAndPass:true,starter:true});await page.close();
}
await browser.close();await writeFile('evidence/codemirror.json',JSON.stringify({checks,errors},null,2));if(errors.length)throw Error(errors.join('\n'));console.log(checks);
