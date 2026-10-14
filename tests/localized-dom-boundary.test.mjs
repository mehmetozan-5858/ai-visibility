import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile(new URL('../components/LanguageProvider.js',import.meta.url),'utf8');
const logic=source.slice(source.indexOf('const staticPairs='),source.indexOf('export function LanguageProvider'));
function element(localized){
 const attrs={'aria-label':'Business name'};
 return {closest:()=>localized?{}:null,getAttribute:k=>attrs[k],setAttribute:(k,v)=>{attrs[k]=v},attrs};
}
test('legacy language translation respects independently localized text and accessible names',()=>{
 const fixed=element(true),legacy=element(false);
 const nodes=[{nodeValue:'Business name',parentElement:fixed},{nodeValue:'Business name',parentElement:legacy}];
 let i=0;
 const document={body:{},createTreeWalker:()=>({nextNode:()=>nodes[i++]||null}),querySelectorAll:()=>[fixed,legacy]};
 const apply=new Function('document','NodeFilter',logic+';return applyStaticTranslations')(document,{SHOW_TEXT:4});
 apply('tr');
 assert.equal(nodes[0].nodeValue,'Business name');assert.equal(fixed.attrs['aria-label'],'Business name');
 assert.equal(nodes[1].nodeValue,'İşletme adı');assert.equal(legacy.attrs['aria-label'],'İşletme adı');
});
