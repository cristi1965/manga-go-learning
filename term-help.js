let termDefinitions = [];
try { ({termDefinitions} = await import('./term-definitions.js')); }
catch (error) { console.warn('详细术语库暂不可用，保留本节简释。', error); }
const definitions = new Map();
const aliases = new Map();
for (const entry of termDefinitions) {
  definitions.set(entry.term, entry);
  for (const name of [entry.term, ...(entry.aliases || [])]) aliases.set(name, entry.term);
}
let dialog, tooltip, activeButton, tipButton, hideTimer;
const node = (tag, text, cls) => {const el=document.createElement(tag);if(text)el.textContent=text;if(cls)el.className=cls;return el;};
function init() {
 if(dialog)return;
 tooltip=node('div','','term-tooltip');tooltip.id='termTooltip';tooltip.role='tooltip';tooltip.hidden=true;document.body.append(tooltip);
 dialog=node('dialog','','term-dialog');dialog.setAttribute('aria-labelledby','termHeading');document.body.append(dialog);
 dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
 dialog.addEventListener('close',()=>{activeButton?.focus({preventScroll:true});});
}
function openTerm(key, button) {
 init(); const entry=definitions.get(key);if(!entry)return;
 activeButton=button;hideTip();dialog.replaceChildren();
 const header=node('header');const heading=node('h2',`${entry.term} · ${entry.chinese}`);heading.id='termHeading';
 const close=node('button','关闭 ×','term-close');close.type='button';close.addEventListener('click',()=>dialog.close());header.append(heading,close);dialog.append(header);
 dialog.append(node('p',entry.summary,'term-summary'));
 for(const [title,text] of [['具体是什么意思',entry.explanation],['例子',entry.example],['容易误解的地方',entry.pitfall]]) {
  if(!text)continue;const section=node('section');section.append(node('h3',title),node(title==='例子'?'pre':'p',text));dialog.append(section);
 }
 if(entry.related?.length){const section=node('section');section.append(node('h3','相关术语'));for(const name of entry.related){const key=aliases.get(name);if(key){const link=node('button',name,'term-related');link.addEventListener('click',()=>openTerm(key,activeButton));section.append(link);}}dialog.append(section);}
 if(entry.source){const link=node('a','查看官方资料 ↗');link.href=entry.source;link.target='_blank';link.rel='noopener noreferrer';dialog.append(link);dialog.append(node('p','链接用于查阅相关机制；教材自定义类型以本项目的代码定义为准。','term-note'));}
 else dialog.append(node('p','本条来自本节术语简释，尚未扩展为完整专题。','term-note'));
 if(!dialog.open)dialog.showModal();close.focus();
}
function showTip(button,key) {
 init();clearTimeout(hideTimer);if(tipButton===button&&!tooltip.hidden)return;tipButton=button;const entry=definitions.get(key);tooltip.textContent=`${entry.chinese}：${entry.summary} 点击查看详细解释。`;tooltip.hidden=false;
 button.setAttribute('aria-describedby','termTooltip');
 const rect=button.getBoundingClientRect();const width=Math.min(340,innerWidth-24);tooltip.style.width=`${width}px`;
 tooltip.style.left=`${Math.max(12,Math.min(rect.left,innerWidth-width-12))}px`;
 const height=tooltip.offsetHeight;tooltip.style.top=`${Math.max(8,rect.top>height+16?rect.top-height-8:Math.min(rect.bottom+8,innerHeight-height-8))}px`;
}
function scheduleHide(){clearTimeout(hideTimer);hideTimer=setTimeout(hideTip,100);}
function hideTip(){clearTimeout(hideTimer);tipButton=null;if(tooltip)tooltip.hidden=true;document.querySelectorAll('[aria-describedby="termTooltip"]').forEach(e=>e.removeAttribute('aria-describedby'));}
const escapeRegex=text=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export function enhanceTerms(root,unit) {
 init();hideTip();
 for(const item of unit.glossary || []){
  if(aliases.has(item.term)||!/^[A-Za-z]/.test(item.term))continue;
  const key=`${unit.id}:${item.term}`;
  definitions.set(key,{term:item.term,chinese:'本节术语',summary:item.meaning});
 }
 const local=new Map(aliases);
 for(const item of unit.glossary||[]){const key=`${unit.id}:${item.term}`;if(definitions.has(key))local.set(item.term,key);}
 const names=[...local.keys()].sort((a,b)=>b.length-a.length);
 const regex=new RegExp(`(?<![A-Za-z0-9_])(?:${names.map(escapeRegex).join('|')})(?![A-Za-z0-9_])`,'g');
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(text){
  if(!text.nodeValue.trim()||text.parentElement.closest('button,a,pre,textarea,select,option,input,summary,dialog,.cm-host,.code-editor,.code-backdrop,.term-tooltip,[data-no-terms]'))return NodeFilter.FILTER_REJECT;
  return NodeFilter.FILTER_ACCEPT;
 }});
 const texts=[];while(walker.nextNode())texts.push(walker.currentNode);
 for(const text of texts){const matches=[...text.nodeValue.matchAll(regex)];if(!matches.length)continue;const frag=document.createDocumentFragment();let pos=0;
  for(const match of matches){frag.append(document.createTextNode(text.nodeValue.slice(pos,match.index)));const key=local.get(match[0]);const entry=definitions.get(key);const button=node('button',match[0],'term-trigger');button.type='button';button.setAttribute('aria-label',`${match[0]}，查看中文解释`);button.setAttribute('aria-haspopup','dialog');button.addEventListener('click',()=>openTerm(key,button));button.addEventListener('mouseenter',()=>showTip(button,key));button.addEventListener('focus',()=>showTip(button,key));button.addEventListener('mouseleave',scheduleHide);button.addEventListener('blur',hideTip);button.addEventListener('keydown',e=>{if(e.key==='Escape')hideTip();});frag.append(button);pos=match.index+match[0].length;}
  frag.append(document.createTextNode(text.nodeValue.slice(pos)));text.replaceWith(frag);
 }
}
window.addEventListener('scroll',hideTip,true);
window.addEventListener('resize',hideTip);
