import {basicSetup} from 'codemirror';
import {EditorView, keymap} from '@codemirror/view';
import {EditorState, Compartment} from '@codemirror/state';
import {indentWithTab} from '@codemirror/commands';
import {go} from '@codemirror/lang-go';
import {HighlightStyle,syntaxHighlighting} from '@codemirror/language';
import {tags} from '@lezer/highlight';
const live = new Set();
const dark = () => document.body.classList.contains('dark');
const valueProperty = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value');
const theme = EditorView.theme({
 '&':{fontSize:'14px',borderRadius:'10px'},
 '.cm-scroller':{fontFamily:'"SFMono-Regular", Menlo, Consolas, monospace',lineHeight:'1.7',overflow:'auto'},
 '.cm-content':{padding:'16px 0',minHeight:'300px'},
 '.cm-line':{padding:'0 14px'},
 '.cm-gutters':{padding:'16px 0'},
 '&.cm-focused':{outline:'2px solid var(--blue)',outlineOffset:'2px'},
 '.cm-scroller::-webkit-scrollbar':{height:'10px'},
});
const darkContrast = HighlightStyle.define([
 {tag:[tags.keyword,tags.operatorKeyword,tags.modifier],color:'#ff9bc8'},
 {tag:[tags.name,tags.deleted,tags.character,tags.propertyName,tags.macroName],color:'#e9edf5'},
 {tag:[tags.function(tags.variableName),tags.labelName],color:'#7fdbff'},
 {tag:[tags.color,tags.constant(tags.name),tags.standard(tags.name)],color:'#d69cff'},
 {tag:[tags.definition(tags.name),tags.separator],color:'#8fe3f0'},
 {tag:[tags.typeName,tags.className,tags.number,tags.changed,tags.annotation,tags.self,tags.namespace],color:'#c8e88b'},
 {tag:[tags.string,tags.inserted,tags.special(tags.string)],color:'#ffc47a'},
 {tag:[tags.meta,tags.comment],color:'#b3bfce'},
 {tag:[tags.regexp,tags.escape,tags.special(tags.variableName)],color:'#72e0cd'},
 {tag:[tags.invalid],color:'#ff8f96'}
]);
const darkSurface = EditorView.theme({
 '&':{color:'#e9edf5',backgroundColor:'#182334'},
 '.cm-content':{caretColor:'#ffffff'},
 '.cm-cursor,.cm-dropCursor':{borderLeftColor:'#ffffff'},
 '.cm-gutters':{color:'#b8c2d0',backgroundColor:'#182334',borderRightColor:'#435066'},
 '.cm-activeLine,.cm-activeLineGutter':{backgroundColor:'#263247'},
 '.cm-selectionBackground,&.cm-focused .cm-selectionBackground':{backgroundColor:'rgba(70,130,190,.42)'},
 '.cm-content ::selection':{backgroundColor:'rgba(70,130,190,.42)',color:'#f4f8ff'}
},{dark:true});
// Every editor uses a dark code surface in both page themes, so its syntax
// palette must not fall back to CodeMirror's low-contrast light defaults.
function themeExtensions(){return [darkSurface,syntaxHighlighting(darkContrast),theme];}
new MutationObserver(()=>{
 for(const entry of live){
  if(!entry.host.isConnected){entry.observer.disconnect();entry.view.destroy();live.delete(entry);continue;}
  if(entry.dark!==dark()){entry.dark=dark();entry.view.dispatch({effects:entry.theme.reconfigure(themeExtensions())});}
 }
}).observe(document.body,{attributes:true,attributeFilter:['class'],childList:true,subtree:true});
export function mountCodeEditor(textarea){
 if(!textarea||textarea.__codeMirror)return;
 const host=document.createElement('div');host.className='cm-host';textarea.before(host);
 const compartment=new Compartment(),readonly=new Compartment();
 let syncing=false;
 const view=new EditorView({parent:host,doc:textarea.value,extensions:[basicSetup,go(),compartment.of(themeExtensions()),readonly.of(EditorState.readOnly.of(textarea.disabled||textarea.readOnly)),EditorView.contentAttributes.of({'aria-label':textarea.getAttribute('aria-label')||'Go 代码编辑器'}),keymap.of([indentWithTab,{key:'Mod-Enter',run:()=>{const root=textarea.closest('[data-code-exercise],.starter,.code-shell');root?.querySelector('[data-run-exercise],.starter-run,[data-run-unit]')?.click();return true;}}]),EditorView.updateListener.of(update=>{
  if(!update.docChanged||syncing)return;
  valueProperty.set.call(textarea,update.state.doc.toString());textarea.dispatchEvent(new Event('input',{bubbles:true}));
 })]});
 view.scrollDOM.tabIndex=0;
 const sync=()=>{const text=valueProperty.get.call(textarea);if(text!==view.state.doc.toString()){syncing=true;view.dispatch({changes:{from:0,to:view.state.doc.length,insert:text}});syncing=false;}};
 Object.defineProperty(textarea,'value',{configurable:true,get(){return valueProperty.get.call(this)},set(v){valueProperty.set.call(this,v);sync();}});
 textarea.addEventListener('input',sync);
 textarea.hidden=true;textarea.__codeMirror=view;
 const observer=new MutationObserver(()=>view.dispatch({effects:readonly.reconfigure(EditorState.readOnly.of(textarea.disabled||textarea.readOnly))}));
 observer.observe(textarea,{attributes:true,attributeFilter:['disabled','readonly']});
 live.add({view,host,observer,theme:compartment,dark:dark()});
 return view;
}
