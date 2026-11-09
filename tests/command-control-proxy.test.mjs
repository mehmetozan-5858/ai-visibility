import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const text=(await readFile(new URL('../proxy.js',import.meta.url),'utf8')).replace(/^import .*;\s*$/mg,'').replaceAll('export ','');
class NextResponse extends Response{static next(){return new Response('next')}static redirect(){return new Response(null,{status:307})}}
const proxy=new Function('NextResponse','verifyAdminToken','verifyClientToken','authConfigured',text+';return proxy')(NextResponse,async()=>false,async()=>false,()=>true);
function req(path,method){const u=new URL(path,'https://example.org');return {method,nextUrl:Object.assign(u,{clone:()=>new URL(u)}),headers:new Headers(),cookies:{get:()=>undefined}}}
test('only exact command POST reaches its own signed-agent boundary',async()=>{
 assert.equal(await (await proxy(req('/api/command-control','POST'))).text(),'next');
 for(const [path,method] of [['/api/command-control','GET'],['/api/command-control/extra','POST'],['/api/clients','POST']])
  assert.equal((await proxy(req(path,method))).status,401);
});
test('sandbox isolation blocks command POST before agent authentication delegation',async()=>{
 const old={...process.env};
 try{process.env.PADDLE_SANDBOX_ENABLED='true';process.env.PADDLE_ENVIRONMENT='sandbox';process.env.VERCEL_ENV='preview';
  assert.equal((await proxy(req('/api/command-control','POST'))).status,404);
 }finally{for(const k of ['PADDLE_SANDBOX_ENABLED','PADDLE_ENVIRONMENT','VERCEL_ENV']){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}}
});
