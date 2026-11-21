import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {repeatEvidenceOptions} from '../lib/answer-evidence-comparison.js';
import {ZERA_ALTERNATE_FREE_MODEL} from '../lib/free-answer-evidence.mjs';
import {evidenceQueries} from '../lib/answer-evidence-rules.js';
const source=(await readFile(new URL('../app/api/answer-evidence/route.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'').replace(/export /g,'');
const id='01a11278-c210-7176-bc7f-0196dec182ec';
function fixture({denied=false,origin=false,missing=false,statusFail=false,freeReady=false,customer={}}={}){let calls=0;const models=[],measurements=[];const row={id,name:'Acme Precision',domain:'acme.com',sector:'Machining',city:'Berlin',...customer};const deps={ZERA_ALTERNATE_FREE_MODEL,freeMeasurementStatus:()=>({ready:freeReady,priceVerified:false}),collectFreeAnswerEvidence:async(_entity,_options,config)=>models.push(config?.model),requireAdmin:async()=>denied?Response.json({error:'auth-required'},{status:401}):null,enforceSameOrigin:()=>origin?Response.json({error:'origin'},{status:403}):null,getClient:async()=>missing?null:row,getClientProfile:async()=>({sector:'Machining',city:'Berlin'}),repeatEvidenceOptions,getAnswerEvidenceRun:async()=>({id,entityId:id,entityType:'prospect',entityName:row.name,domain:row.domain,result:{queries:['Suggest machining providers in Berlin.'],observations:[{provider:'Gemini'}],errors:[]}}),getProspect:async()=>missing?null:row,answerProviders:()=>['Gemini'],boardAnswerProviders:()=>freeReady?['Gemini','google/gemma-4-31b-it:free','liquid/lfm-3-1.7b:free']:['Gemini'],evidenceQueries,answerEvidenceStatus:async()=>{if(statusFail)throw Error('database-unavailable');return {supported:true}},listAnswerEvidence:async()=>[],measureAnswerEvidence:async(entity,options,overrides)=>{calls++;measurements.push(options);if(overrides?.collect)await overrides.collect(entity,options);assert.equal(entity.name,row.name);assert.equal(options.queries.length,1);return {id:'run'}}};const api=new Function(...Object.keys(deps),source+';return {GET,POST};')(...Object.values(deps));return {api,calls:()=>calls,models,measurements}}
const req=body=>new Request('https://example.com/api/answer-evidence',{method:'POST',body:JSON.stringify(body)});
test('admin authentication and same-origin checks precede every evidence write',async()=>{for(const config of [{denied:true},{origin:true}]){const f=fixture(config);assert.ok([401,403].includes((await f.api.POST(req({entityType:'prospect',entityId:id}))).status));assert.equal(f.calls(),0)}const f=fixture({denied:true});assert.equal((await f.api.GET(new Request('https://example.com/api/answer-evidence'))).status,401)});
test('invalid entity and excessive queries never spend provider requests',async()=>{const f=fixture();for(const body of [{entityType:'prospect',entityId:'bad'},{entityType:'unknown',entityId:id},{entityType:'prospect',entityId:id,queries:['One valid query?','Another valid query?','Third valid query?']}])assert.equal((await f.api.POST(req(body))).status,400);assert.equal(f.calls(),0);const missing=fixture({missing:true});assert.equal((await missing.api.POST(req({entityType:'prospect',entityId:id}))).status,404)});
test('valid record uses server business context and generated neutral query',async()=>{const f=fixture();assert.equal((await f.api.POST(req({entityType:'client',entityId:id,name:'Injected name',sector:'Injected sector'}))).status,200);assert.equal(f.calls(),1)});

test('repeat reads recorded queries and provider set on server; rejects forged identity or query override',async()=>{const f=fixture();assert.equal((await f.api.POST(req({entityType:'prospect',entityId:id,repeatRunId:id}))).status,200);assert.equal(f.calls(),1);assert.equal((await f.api.POST(req({entityType:'client',entityId:id,repeatRunId:id}))).status,409);assert.equal((await f.api.POST(req({entityType:'prospect',entityId:id,repeatRunId:id,queries:['Changed query?']}))).status,400);assert.equal(f.calls(),1)});

test('authenticated read includes scoped automation status without provider spend',async()=>{const f=fixture();const response=await f.api.GET(new Request('https://example.com/api/answer-evidence?entityType=prospect&entityId='+id));assert.equal(response.status,200);assert.equal((await response.json()).status.supported,true);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(f.calls(),0)});

test('monitor failure preserves raw history and reports unknown counts instead of zero',async()=>{const f=fixture({statusFail:true});const response=await f.api.GET(new Request('https://example.com/api/answer-evidence'));assert.equal(response.status,200);const d=await response.json();assert.deepEqual(d.runs,[]);assert.match(d.status.error,/bilinmiyor/);assert.equal(d.status.counts,undefined);assert.equal(f.calls(),0)});

test('free-only writes stay authenticated, fail closed on missing configuration and select only the free collector',async()=>{
 const body={entityType:'prospect',entityId:id,freeOnly:true};
 for(const config of [{denied:true},{origin:true}]){const f=fixture({...config,freeReady:true});assert.ok([401,403].includes((await f.api.POST(req(body))).status));assert.equal(f.calls(),0)}
 const blocked=fixture();assert.equal((await blocked.api.POST(req(body))).status,503);assert.equal(blocked.calls(),0);
 const ready=fixture({freeReady:true});assert.equal((await ready.api.POST(req(body))).status,200);assert.equal(ready.calls(),1);
 for(const change of [{freeOnly:'true'},{repeatRunId:id},{entityType:'client',baseline:true}]){const f=fixture({freeReady:true});assert.equal((await f.api.POST(req({...body,...change}))).status,400);assert.equal(f.calls(),0)}
});

test('alternate model is server-selected for one explicit active ZERA pilot query only',async()=>{
 const body={entityType:'client',entityId:id,freeOnly:true,zeraAlternateFreeModel:true,queries:['Welche Modegeschäfte gibt es in Wetzlar?']};
 const customer={name:'ZERA Clothing',plan:'Pilot',status:'active'};
 const ready=fixture({freeReady:true,customer});
 assert.equal((await ready.api.POST(req({...body,model:'paid/model'}))).status,200);
 assert.deepEqual(ready.models,[ZERA_ALTERNATE_FREE_MODEL]);
 for(const [change,client] of [[{},{}],[{}, {...customer,status:'suspended'}],[{entityType:'prospect'},customer],[{queries:[]},customer],[{queries:[...body.queries,'What else is nearby?']},customer],[{freeOnly:false},customer]]){
  const rejected=fixture({freeReady:true,customer:client});
  assert.equal((await rejected.api.POST(req({...body,...change}))).status,400);
  assert.equal(rejected.calls(),0);
 }
});

test('board free comparison accepts one neutral query and only server-selected free models',async()=>{
 const body={entityType:'client',entityId:id,freeBoard:true,queries:['Wo finde ich Damenmode in Wetzlar?']};
 const ready=fixture({freeReady:true});
 assert.equal((await ready.api.POST(req({...body,providers:['Gemini']}))).status,200);
 assert.equal(ready.measurements[0].includeBoardModels,true);
 assert.deepEqual(ready.measurements[0].providers,['google/gemma-4-31b-it:free','liquid/lfm-3-1.7b:free']);
 for(const change of [{freeBoard:'true'},{freeOnly:true},{baseline:true},{repeatRunId:id},
  {queries:['Acme Precision in Berlin?']},{queries:[...body.queries,'Which boutiques are nearby?']}]){
  const rejected=fixture({freeReady:true});
  assert.equal((await rejected.api.POST(req({...body,...change}))).status,400);
  assert.equal(rejected.calls(),0);
 }
 const unconfigured=fixture();
 assert.equal((await unconfigured.api.POST(req(body))).status,503);
 assert.equal(unconfigured.calls(),0);
});
