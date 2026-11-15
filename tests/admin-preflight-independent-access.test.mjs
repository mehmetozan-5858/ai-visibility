import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('admin OpenRouter no-inference preflight is accessible without applicant preparation',async()=>{
 const ui=await read('components/ApplicantIntakeConsole.js');
 const anchor=ui.indexOf('<h3>OpenRouter bağlantı denetimi (yalnız yönetici)</h3>');
 const form=ui.indexOf('<form className="client-form"');
 const conditionalBusiness=ui.indexOf('{business&&<div>');
 assert.ok(anchor>0 && form>anchor && conditionalBusiness>form,
  'preflight control must precede applicant form and business-dependent UI');
 const button='onClick={()=>run(\'preflight\')}>Ücretsiz bağlantıyı AI çağrısı yapmadan denetle';
 assert.equal(ui.split(button).length-1,1,'one independent preflight control');
 const run=ui.slice(ui.indexOf("if(action==='preflight')"),ui.indexOf("if(action==='measure')"));
 assert.match(run,/fetch\('\/api\/admin\/free-provider-preflight'/);
 assert.doesNotMatch(run,/\/api\/answer-evidence|\/api\/admin\/applicant-intake|\/api\/admin\/applicant-domain-proof/);
});

test('preflight remains admin-only, rate-limited and read-only',async()=>{
 const route=await read('app/api/admin/free-provider-preflight/route.js');
 const service=await read('lib/free-provider-preflight.mjs');
 assert.match(route,/requireAdmin\(req\)/);
 assert.match(route,/checkRateLimit\(req/);
 assert.match(route,/readFreeProviderAccess\(\{env:process\.env\}\)/);
 assert.match(service,/https:\/\/openrouter\.ai\/api\/v1\/key/);
 assert.match(service,/https:\/\/openrouter\.ai\/api\/v1\/models/);
 assert.doesNotMatch(service,/chat\/completions|method:'POST'|inferenceRequests:1/);
});
