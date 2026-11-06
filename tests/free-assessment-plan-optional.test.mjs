import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../components/NewCustomerLeadForm.js',import.meta.url),'utf8');
const api=await readFile(new URL('../app/api/leads/route.js',import.meta.url),'utf8');
const storage=await readFile(new URL('../lib/leads.js',import.meta.url),'utf8');
test('free assessment is not blocked by paid plan selection',()=>{
 assert.match(source,/<select value=\{form\.service\} onChange=\{e=>change\("service",e\.target\.value\)\}>/);
 assert.match(source,/Free assessment only — no plan selected/);
 assert.match(source,/Yalnızca ücretsiz ön değerlendirme — plan seçilmedi/);
 assert.doesNotMatch(source,/<select value=\{form\.service\}[^>]* required>/);
});
test('form still submits the existing lead payload and does not trigger checkout',()=>{
 assert.match(source,/fetch\("\/api\/leads",\{method:"POST"/);
 assert.match(source,/body:JSON\.stringify\(\{\.\.\.form,language:lang\}\)/);
 assert.match(api,/const lead=await createLead\(body\|\|\{\}\)/);
 assert.match(storage,/clean\(input\.service,80\)/);
 assert.doesNotMatch(source,/fetch\("\/api\/payments/);
});
