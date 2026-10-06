import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../proxy.js',import.meta.url),'utf8');
const authSource=source.slice(source.indexOf('const AGENT_CYCLE_PATHS='),source.indexOf('export async function proxy'));
const {authorizedAgentCycle}=await import('data:text/javascript;base64,'+Buffer.from(authSource).toString('base64'));
const request=(pathname,token,method='GET')=>({method,nextUrl:{pathname},headers:new Headers(token?{authorization:`Bearer ${token}`}:{})});
process.env.AUTO_HUNT_SECRET='test-scheduler-secret';delete process.env.CRON_SECRET;
test('all scheduled routes accept the configured scheduler key',async()=>{
 const workflow=await readFile(new URL('../.github/workflows/global-auto-hunt.yml',import.meta.url),'utf8');
 const paths=[...workflow.matchAll(/https:\/\/www\.aivisibilityworks\.com(\/api\/[a-z/-]+)/g)].map(x=>x[1]);
 assert.ok(paths.length>30);for(const path of paths)assert.equal(authorizedAgentCycle(request(path,'test-scheduler-secret')),true,path);
});
test('scheduler key grants no access to admin/customer/payment APIs or writes',()=>{
 for(const path of ['/api/admin-payments','/api/client-portal','/api/executive-daily-report','/admin','/api/follow-up-cycle/extra'])assert.equal(authorizedAgentCycle(request(path,'test-scheduler-secret')),false,path);
 assert.equal(authorizedAgentCycle(request('/api/follow-up-cycle','test-scheduler-secret','POST')),false);
});
test('missing, wrong or empty credentials never bypass the session gate',()=>{
 assert.equal(authorizedAgentCycle(request('/api/follow-up-cycle')),false);
 assert.equal(authorizedAgentCycle(request('/api/follow-up-cycle','wrong')),false);
 delete process.env.AUTO_HUNT_SECRET;
 assert.equal(authorizedAgentCycle(request('/api/follow-up-cycle','')),false);
});
