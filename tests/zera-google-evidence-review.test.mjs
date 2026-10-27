import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const route=readFileSync(new URL('../app/api/clients/zera-google-evidence/route.js',import.meta.url),'utf8');
test('Google evidence route requires admin and origin on writes',()=>{
 assert.match(route,/export async function POST/);
 assert.match(route,/await requireAdmin\(req\)/);
 assert.match(route,/enforceSameOrigin\(req\)/);
});
test('staged Google evidence cannot count as verified results',()=>{
 assert.match(route,/pending-review/g);
 assert.match(route,/verified:false/);
 assert.match(route,/visibilityScore:null/);
 assert.match(route,/if\(body\.verified===true\)/);
});
test('duplicate source submissions do not overwrite evidence',()=>{
 assert.match(route,/PRIMARY KEY\(client_id,task_id,source_url\)/);
 assert.match(route,/ON CONFLICT DO NOTHING/);
});
test('route has no provider calls or automatic scans',()=>{
 assert.doesNotMatch(route,/compareCustomerProviders|GEMINI_API_KEY|generateContent|google_search:/);
});

test('read-only status shows five pending tasks regardless of staged source count',()=>{
 assert.match(route,/const taskStatus=tasks\.map/);
 assert.match(route,/status:'pending',candidates:/);
 assert.match(route,/verified:0,pending:tasks\.length,visibilityScore:null/);
});
