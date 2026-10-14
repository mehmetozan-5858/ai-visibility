import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import robots from '../app/robots.js';
import sitemap from '../app/sitemap.js';

const source=fs.readFileSync(new URL('../proxy.js',import.meta.url),'utf8').replace(/^import .*;\s*$/mg,'').replaceAll('export ','');
class NextResponse extends Response{
 static next(){return new Response('next')}
 static redirect(){return new Response(null,{status:307})}
}
const proxy=new Function('NextResponse','verifyAdminToken','verifyClientToken','authConfigured',source+';return proxy')(NextResponse,async()=>false,async()=>false,()=>true);
function request(path){const u=new URL(path,'https://www.aivisibilityworks.com');return {method:'GET',nextUrl:Object.assign(u,{clone:()=>new URL(u)}),headers:new Headers(),cookies:{get:()=>undefined}}}

test('anonymous crawlers can fetch discovery documents without opening private routes',async()=>{
 const old=process.env.PADDLE_SANDBOX_ENABLED;process.env.PADDLE_SANDBOX_ENABLED='false';
 try{
  for(const path of ['/robots.txt','/sitemap.xml']){const r=await proxy(request(path));assert.equal(r.status,200);assert.equal(await r.text(),'next')}
  for(const path of ['/admin','/musteri-panel'])assert.equal((await proxy(request(path))).status,307);
  assert.equal((await proxy(request('/api/clients'))).status,401);
 }finally{if(old===undefined)delete process.env.PADDLE_SANDBOX_ENABLED;else process.env.PADDLE_SANDBOX_ENABLED=old}
});
test('sitemap contains unique canonical public pages, excluding customer and payment URLs',()=>{
 const urls=sitemap().map(x=>x.url);assert.equal(new Set(urls).size,urls.length);
 assert.ok(urls.includes('https://www.aivisibilityworks.com'));
 for(const url of urls){assert.equal(new URL(url).origin,'https://www.aivisibilityworks.com');assert.ok(!/\/api\/|\/admin|\/musteri-panel|\/odeme|token=/.test(url))}
});
test('robots advertises the public sitemap and restricts API and customer routes',()=>{
 const result=robots();assert.equal(result.sitemap,'https://www.aivisibilityworks.com/sitemap.xml');assert.equal(result.rules.allow,'/');assert.ok(result.rules.disallow.includes('/api/'));assert.ok(result.rules.disallow.includes('/musteri-panel'));
});
