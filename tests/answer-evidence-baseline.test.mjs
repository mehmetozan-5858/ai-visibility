import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {clientBaselineOptions} from '../lib/answer-evidence-baseline.js';
import {evidenceQueries,answerObservation,answerSummary,parsePerplexityAnswer} from '../lib/answer-evidence-rules.js';
import {implementationAnswerOptions} from '../lib/answer-evidence-work-rules.js';
const entity={id:'01a11278-c210-7176-bc7f-0196dec182ec',entityType:'client',name:'Acme Precision',domain:'acme.com',sector:'machining',city:'Berlin',country:'Germany',status:'active',paid:true};
test('baseline preparation selects exactly one configured provider and a neutral query',()=>{
 const r=clientBaselineOptions(entity,[],'en',['Gemini','Perplexity','ChatGPT']);assert.deepEqual(r.providers,['Perplexity']);assert.equal(r.queries.length,1);assert.equal(r.measurementPurpose,'implementation-baseline-candidate');assert.equal(r.implementationContext,undefined);
 assert.deepEqual(clientBaselineOptions(entity,[],'en',['Gemini']).providers,['Gemini']);
 for(const queries of [['Tell me about Acme Precision.'],['Tell me about acme.com.'],['Suggest suppliers in Berlin.','Suggest suppliers in Munich.']])assert.throws(()=>clientBaselineOptions(entity,queries,'en',['Gemini']));
 assert.throws(()=>clientBaselineOptions(entity,[],'en',[]));assert.throws(()=>clientBaselineOptions({...entity,entityType:'prospect'},[],'en',['Gemini']));
});
const providerSource=(await readFile(new URL('../lib/answer-evidence-providers.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'').replace(/export /g,'');
const {collectAnswerEvidence}=new Function('answerObservation','answerSummary','evidenceQueries','parsePerplexityAnswer','withRequestBudget',providerSource+';return {collectAnswerEvidence};')(answerObservation,answerSummary,evidenceQueries,parsePerplexityAnswer,async(ms,fn)=>fn());
test('prepared baseline makes one call and can support only a genuinely later completed work record',async()=>{
 let calls=0;const options=clientBaselineOptions(entity,[],'en',['Gemini','ChatGPT']);const result=await collectAnswerEvidence(entity,{...options,env:{GEMINI_API_KEY:'fixture',OPENAI_API_KEY:'fixture'},request:async()=>{calls++;return {text:'Other suppliers.',model:'fixture',complete:true,citations:[]}},recordCost:async()=>{}});assert.equal(calls,1);assert.equal(result.summary.neutralComplete,1);
 const checked=Date.parse(result.observations[0].checkedAt),baseline={id:'baseline',entityType:'client',entityId:entity.id,entityName:entity.name,domain:entity.domain,createdAt:new Date(checked).toISOString(),result};
 const work={id:'work',clientId:entity.id,title:'Updated metadata',status:'completed',completionEvidence:'The administrator checked the published metadata.',evidenceRecordedAt:new Date(checked+1000).toISOString()};
 assert.equal(implementationAnswerOptions(entity,baseline,work,{providers:['Gemini'],now:new Date(checked+86401000).toISOString()}).repeatRunId,'baseline');
 assert.throws(()=>implementationAnswerOptions(entity,baseline,{...work,evidenceRecordedAt:new Date(checked-1000).toISOString()},{providers:['Gemini'],now:new Date(checked+86401000).toISOString()}));
});
test('failed baseline call remains a failure and cannot become the pre-work answer',async()=>{
 const result=await collectAnswerEvidence(entity,{...clientBaselineOptions(entity,[],'en',['Gemini']),env:{GEMINI_API_KEY:'fixture'},request:async()=>{throw Error('timeout')},recordCost:async()=>{}});assert.equal(result.observations.length,0);assert.equal(result.errors.length,1);assert.equal(result.summary.neutralComplete,0);
 const baseline={id:'baseline',entityType:'client',entityId:entity.id,entityName:entity.name,domain:entity.domain,createdAt:'2026-10-01T10:00:00Z',result},work={id:'work',clientId:entity.id,status:'completed',completionEvidence:'Administrator recorded completion evidence.',evidenceRecordedAt:'2026-10-02T10:00:00Z'};assert.throws(()=>implementationAnswerOptions(entity,baseline,work,{providers:['Gemini'],now:'2026-10-03T10:00:00Z'}));
});
const route=(await readFile(new URL('../app/api/answer-evidence/route.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'').replace(/export /g,'');
function api(){const calls=[];const {POST}=new Function('clientBaselineOptions','requireAdmin','enforceSameOrigin','getClient','getClientProfile','getProspect','answerProviders','evidenceQueries','measureAnswerEvidence',route+';return {POST};')(clientBaselineOptions,async()=>null,()=>null,async()=>entity,async()=>({sector:entity.sector,city:entity.city,country:entity.country}),async()=>entity,()=>['Gemini','ChatGPT'],evidenceQueries,async(e,o)=>{calls.push(o);return {id:'run',result:{}}});return {calls,POST}}
test('API builds baseline options server-side and rejects prospect/repeat/multiple/prompted requests before spending',async()=>{
 const f=api(),request=body=>new Request('https://example.test/api/answer-evidence',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),body={entityType:'client',entityId:entity.id,baseline:true,language:'en'};
 assert.equal((await f.POST(request({...body,providers:['ChatGPT'],measurementPurpose:'fake'}))).status,200);assert.deepEqual(f.calls[0].providers,['Gemini']);assert.equal(f.calls[0].measurementOrigin,'admin');assert.equal(f.calls[0].measurementPurpose,'implementation-baseline-candidate');
 for(const extra of [{entityType:'prospect'},{baseline:false},{repeatRunId:entity.id},{queries:['Tell me about Acme Precision.']},{queries:['Suggest providers in Berlin.','Suggest providers in Munich.']}])assert.equal((await f.POST(request({...body,...extra}))).status,400);
 assert.equal(f.calls.length,1);
});
