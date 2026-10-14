import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../app/api/paddle-sandbox/test-session/route.js',import.meta.url),'utf8');
const body=source.replace(/^import .*;\n/gm,'').replace(/export const runtime=.*;\n/,'').replace('export async function POST','async function POST');
function route({enabled=true,limited=null,mint=()=> 'local-fixture-cookie'}={}){
 return new Function('sandboxEnabled','createSandboxSession','SANDBOX_SESSION_COOKIE','checkRateLimit',`${body};return POST`)(()=>enabled,mint,'ai_paddle_sandbox_client',()=>limited);
}
function request(body={},headers={}){return new Request('https://fixture.example/api/paddle-sandbox/test-session',{method:'POST',headers:{origin:'https://fixture.example','content-type':'application/json',...headers},body:JSON.stringify(body)})}
test('fixture route is disabled in production and requires same-origin JSON',async()=>{
 assert.equal((await route({enabled:false})(request())).status,404);
 for(const headers of [{origin:'https://foreign.example'},{origin:''},{'content-type':'text/plain'}])assert.equal((await route()(request({},headers))).status,403);
});
test('fixture route refuses all buyer-controlled account and token fields',async()=>{
 for(const body of [{clientId:'victim'},{token:'forged'},[],null,'victim'])assert.equal((await route()(request(body))).status,400);
});
test('fixture route creates a host-only protected cookie and never exposes it in JSON',async()=>{
 const response=await route()(request());const cookie=response.headers.get('set-cookie');
 assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
 for(const flag of ['HttpOnly','Secure','SameSite=Strict','Max-Age=3600'])assert.ok(cookie.includes(flag));
 assert.equal(cookie.includes('Domain='),false);
 assert.deepEqual(await response.json(),{ok:true,testOnly:true,productionAccessChanged:false});
});
test('rate-limited fixture request cannot mint a session',async()=>{
 let minted=false;const response=await route({limited:new Response(null,{status:429}),mint:()=>{minted=true}})(request());
 assert.equal(response.status,429);assert.equal(minted,false);
});
test('fixture mint failure remains safe and never sets a cookie',async()=>{
 const response=await route({mint:()=>{throw Error('private-secret')}})(request());
 assert.equal(response.status,503);assert.equal(response.headers.get('set-cookie'),null);assert.equal((await response.text()).includes('private-secret'),false);
});
