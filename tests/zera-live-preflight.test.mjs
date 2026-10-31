import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {inspectGeminiModel,createZeraLivePreflight} from '../lib/zera-live-preflight.mjs';
const own='11111111-1111-4111-8111-111111111111';
test('model inspection uses only fixed-origin metadata GET and never returns key or pricing claims',async()=>{
 const calls=[];const result=await inspectGeminiModel({env:{GEMINI_API_KEY:'PRIVATE'},fetchImpl:async(url,options)=>{calls.push({url,options});return Response.json({name:'models/gemini-3.8-flash',supportedGenerationMethods:['generateContent']})}});
 assert.equal(result.modelAccessible,true);assert.equal(result.contentGenerationRequests,0);assert.equal(result.quotaVerified,false);assert.equal(result.freeTierVerified,false);
 assert.equal(calls[0].options.method,'GET');assert.equal(calls[0].options.redirect,'error');assert.ok(!calls[0].options.body);assert.doesNotMatch(calls[0].url,/PRIVATE/);assert.doesNotMatch(JSON.stringify(result),/PRIVATE/);
});
test('invalid model and missing key make no requests; permission and invalid metadata fail closed',async()=>{
 let calls=0;const fetchImpl=async()=>{calls++;return new Response('PRIVATE',{status:403})};
 assert.equal((await inspectGeminiModel({env:{ZERA_GEMINI_MODEL:'../private',GEMINI_API_KEY:'PRIVATE'},fetchImpl})).providerRequests,0);
 assert.equal((await inspectGeminiModel({env:{},fetchImpl})).providerRequests,0);assert.equal(calls,0);
 const denied=await inspectGeminiModel({env:{GEMINI_API_KEY:'PRIVATE'},fetchImpl});assert.equal(denied.reason,'provider-permission-denied');assert.doesNotMatch(JSON.stringify(denied),/PRIVATE/);
 const wrong=await inspectGeminiModel({env:{GEMINI_API_KEY:'PRIVATE'},fetchImpl:async()=>Response.json({name:'models/other',supportedGenerationMethods:['generateContent']})});assert.equal(wrong.modelAccessible,false);
});
test('storage preparation preserves failed task history and never calls providers',async()=>{
 const db=new PGlite();let providerCalls=0;
 try{
  await db.exec(`CREATE TABLE clients(id UUID PRIMARY KEY,name TEXT,plan TEXT);INSERT INTO clients VALUES('${own}','ZERA Clothing','Pilot');CREATE TABLE zera_ai_task_attempts(client_id UUID,task_id TEXT,status TEXT);INSERT INTO zera_ai_task_attempts VALUES('${own}','brand-ai-de','provider-failed')`);
  const pool={query:(sql,args)=>db.query(sql,args)};
  const handler=createZeraLivePreflight({authorize:async()=>null,guard:async()=>null,getPool:()=>pool,getSettings:()=>({VERCEL_ENV:'production'}),fetchImpl:async()=>{providerCalls++;throw Error('unexpected')}});
  const req=()=>new Request('https://example.org/api/clients/zera-preflight',{method:'POST',body:JSON.stringify({confirmPrepareStorage:true})});
  assert.equal((await handler.POST(req())).status,200);assert.equal((await handler.POST(req())).status,200);
  assert.equal(providerCalls,0);assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM ai_provider_comparisons')).rows[0].n,0);
  assert.deepEqual((await db.query('SELECT task_id,status,failure_reason FROM zera_ai_task_attempts')).rows,[{task_id:'brand-ai-de',status:'provider-failed',failure_reason:null}]);
 }finally{await db.close()}
});
test('auth, selectors, preview and unconfirmed mutations are rejected before storage',async()=>{
 let allowed=false,production=true,queries=0;
 const handler=createZeraLivePreflight({authorize:async()=>allowed?null:Response.json({error:'unauthorized'},{status:401}),guard:async()=>null,getPool:()=>{queries++;throw Error('unexpected')},getSettings:()=>({VERCEL_ENV:production?'production':'preview'})});
 const req=(url='https://example.org/api/clients/zera-preflight',body={confirmPrepareStorage:true})=>new Request(url,{method:'POST',body:JSON.stringify(body)});
 assert.equal((await handler.POST(req())).status,401);allowed=true;
 assert.equal((await handler.GET(new Request('https://example.org/api/clients/zera-preflight?clientId=other'))).status,400);
 assert.equal((await handler.POST(req(undefined,{confirmPrepareStorage:true,clientId:'other'}))).status,400);
 production=false;assert.equal((await handler.POST(req())).status,403);assert.equal(queries,0);
});
