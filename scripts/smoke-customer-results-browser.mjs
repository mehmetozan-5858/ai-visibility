/** Browser UI fixtures only. PostgreSQL isolation is tested separately.
 * Requires an installed Playwright Chromium (Work runtime or local playwright).
 */
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {createHmac,randomBytes} from 'node:crypto';
import {createServer} from 'node:net';
import {once} from 'node:events';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright':'playwright');
const listener=createServer();listener.listen(0,'127.0.0.1');await once(listener,'listening');
const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));
const origin=`http://127.0.0.1:${port}`,secret=randomBytes(32).toString('hex');
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{
 stdio:'ignore',env:{PATH:process.env.PATH,NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1',AUTH_SECRET:secret,ADMIN_PASSWORD:randomBytes(24).toString('hex')}});
let browser,cases=0;
try{
 let ready=false;
 for(let i=0;i<100;i++){
  try{if((await fetch(origin+'/robots.txt',{signal:AbortSignal.timeout(1000)})).ok){ready=true;break;}}catch{}
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 assert(ready,'production-server-not-ready');browser=await chromium.launch({headless:true});
 for(const fixture of [
  {id:'11111111-1111-4111-8111-111111111111',name:'ZERA Clothing',lang:'tr',width:390},
  {id:'22222222-2222-4222-8222-222222222222',name:'Other Customer',lang:'en',width:1280}
 ]){
  const context=await browser.newContext({viewport:{width:fixture.width,height:900},locale:fixture.lang==='tr'?'tr-TR':'en-US'});
  const exp=Math.floor(Date.now()/1000)+3600,value=`client.${fixture.id}.${exp}`;
  const token=value+'.'+createHmac('sha256',secret).update(value).digest('base64url');
  await context.addCookies([{name:'ai_client',value:token,url:origin},{name:'ai_lang',value:fixture.lang,url:origin}]);
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/api/client-portal',route=>route.fulfill({json:{account:{client:{id:fixture.id,name:fixture.name,domain:'',plan:'Pilot'},access:{allowed:true,kind:'pilot',expiresAt:'2099-01-01T00:00:00.000Z'},payments:[],scans:[],profile:{},work:[]}}}));
  await page.route('**/api/client-portal/solutions',route=>route.fulfill({json:{findings:[]}}));
  await page.route('**/api/client-provider-results',route=>{
   assert.equal(new URL(route.request().url()).search,'');
   return route.fulfill({json:{comparisons:[{id:'comparison1',query:fixture.name+' recorded query',createdAt:'2026-10-26T12:00:00.000Z',results:[{provider:'gemini',status:'answer-received-unverified',verified:false,answer:fixture.name+' recorded answer',sourceUrl:null}]}],visibilityScore:null,sourceSupportedCount:0}});
  });
  await page.goto(origin+'/musteri-panel');
  await page.getByRole('heading',{name:fixture.name,exact:true}).waitFor();
  await page.getByRole('button',{name:fixture.lang==='tr'?/Taramalar/:/Scans/}).first().click();
  const section=page.getByRole('region',{name:fixture.lang==='tr'?'Yapay zekâ yanıtları':'AI assistant answers'});
  await section.getByText(fixture.name+' recorded answer',{exact:true}).waitFor();
  assert.equal((await section.innerText()).includes('/100'),false);
  assert.equal(await page.getByText('ZERA Gemini görevlerini tek onayla çalıştır',{exact:true}).count(),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);cases++;await context.close();
 }
 console.log(JSON.stringify({ok:true,cases,scope:'fixture-backed-customer-browser-ui',liveCustomerAcceptance:false}));
}finally{await browser?.close();server.kill('SIGTERM');await once(server,'exit');}
