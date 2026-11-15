import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('admin dashboard links to standalone no-write provider check',async()=>{
 const dashboard=await read('components/MobileDashboard.js');
 const page=await read('app/admin/openrouter-kontrol/page.js');
 const api=await read('app/api/admin/free-provider-preflight/route.js');
 assert.match(dashboard,/href="\/admin\/openrouter-kontrol"/);
 assert.match(page,/fetch\("\/api\/admin\/free-provider-preflight",\{method:"GET"/);
 assert.match(page,/credentials:"same-origin"/);
 assert.doesNotMatch(page,/\/api\/answer-evidence|applicant-intake|domain-proof|method:"POST"|setTimeout\(/);
 assert.match(api,/requireAdmin\(req\)/);
 assert.match(api,/checkRateLimit\(req/);
});
