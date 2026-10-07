import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compareAnswerEvidence} from '../lib/answer-evidence-comparison.js';
import {brandMatch,evidenceQueries,answerObservation,answerSummary,parsePerplexityAnswer,sourceUrl} from '../lib/answer-evidence-rules.js';
const entity={id:'01a11278-c210-7176-bc7f-0196dec182ec',entityType:'prospect',name:'Acme Precision',domain:'acme.com',sector:'precision machining',city:'Berlin',country:'Germany'};
test('neutral default query omits target name/domain and respects query cap',()=>{
 const q=evidenceQueries(entity,[],'en');assert.equal(q.length,1);assert.equal(q[0].brandPrompted,false);assert.match(q[0].query,/precision machining.*Berlin/);assert.doesNotMatch(q[0].query,/Acme|acme.com/);
 assert.throws(()=>evidenceQueries(entity,['one','two','three']));assert.throws(()=>evidenceQueries(entity,['short']));assert.throws(()=>evidenceQueries({...entity,sector:''},[]));assert.equal(evidenceQueries(entity,['Tell me about Acme Precision.'])[0].brandPrompted,true);
});
test('matches whole normalized brand or domain and rejects partial/foreign-domain matches',()=>{
 for(const text of ['Acme Precision provides tools.','See https://acme.com/','Official acme.com.','Visit www.acme.com'])assert.equal(brandMatch(text,entity),true,text);
 for(const text of ['Acme Precisionary supplies tools.','acme.com.evil.org','fakeacme.com','https://notacme.com'])assert.equal(brandMatch(text,entity),false,text);
});
test('citations come from provider metadata or actual referenced search IDs, never model prose URLs',()=>{
 const d={id:'response',status:'completed',model:'test-model',output:[{type:'search_results',results:[{id:1,url:'https://acme.com/',title:'Acme'},{id:2,url:'https://unused.com/'}]},{type:'search_results',results:[{id:3,url:'https://other.com/'}]},{type:'message',content:[{type:'output_text',text:'A provider answer [1] [3]. A fabricated link https://fake.test',annotations:[]}]}]};
 const parsed=parsePerplexityAnswer(d),row=answerObservation(entity,{...parsed,provider:'Perplexity',query:'Suggest precision machining providers in Berlin.'});assert.equal(row.citations.length,2);assert.equal(row.officialCitation,true);assert.equal(row.brandMentioned,false);assert.ok(row.citations.every(x=>!x.url.includes('fake')&&!x.url.includes('unused')));assert.equal(row.responseId,'response');
});
test('unsafe citation URL cannot become an official source',()=>{for(const raw of ['javascript:alert(1)','http://acme.com','https://secret:pass@acme.com/'])assert.equal(sourceUrl(raw),'');assert.equal(answerObservation(entity,{provider:'Gemini',query:'Which companies?',text:'Acme Precision',citations:[{url:'https://acme.com.evil.org'}]}).officialCitation,false)});
test('prompted, empty, incomplete and failed responses never count as neutral absences',()=>{
 assert.throws(()=>answerObservation(entity,{text:'',query:'Which companies?'}));
 const valid=answerObservation(entity,{text:'Other companies only.',query:'Suggest machining providers in Berlin.'});
 const prompted=answerObservation(entity,{text:'Acme Precision',query:'Tell me about Acme Precision.'});
 const partial=answerObservation(entity,{text:'Other companies',query:'Suggest providers in Berlin.',complete:false});
 const s=answerSummary([valid,prompted,partial],[{error:'timeout'}]);assert.equal(s.neutralComplete,1);assert.equal(s.brandMentions,0);assert.equal(s.failed,1);assert.equal(s.prompted,1);assert.equal(s.incomplete,1);assert.equal(s.score,undefined);
});
const providerSource=(await readFile(new URL('../lib/answer-evidence-providers.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'').replace(/export /g,'');
const {collectAnswerEvidence}=new Function('answerObservation','answerSummary','evidenceQueries','parsePerplexityAnswer','withRequestBudget',providerSource+';return {collectAnswerEvidence};')(answerObservation,answerSummary,evidenceQueries,parsePerplexityAnswer,async(ms,fn)=>fn());
test('collects actual query responses, records cost per success and preserves partial failure',async()=>{
 const calls=[],costs=[];const r=await collectAnswerEvidence(entity,{queries:['Suggest machining providers in Berlin.'],env:{OPENAI_API_KEY:'fixture',GEMINI_API_KEY:'fixture',PERPLEXITY_API_KEY:'fixture'},request:async(p,q)=>{calls.push({p,q});if(p==='Gemini')throw Error('timeout');return {text:p==='ChatGPT'?'Acme Precision.':'Other suppliers',model:'fixture',complete:true,citations:[],usage:p==='Perplexity'?{cost:{total_cost:.01,currency:'USD'}}:null}},recordCost:async c=>costs.push(c)});
 assert.equal(calls.length,3);assert.ok(calls.every(x=>x.q==='Suggest machining providers in Berlin.'));assert.equal(r.observations.length,2);assert.equal(r.summary.neutralComplete,2);assert.equal(r.summary.brandMentions,1);assert.equal(r.errors.length,1);assert.equal(costs.length,2);assert.equal(costs.find(x=>x.provider==='ChatGPT').metadata.pricingSource,'unconfigured-zero');assert.equal(costs.find(x=>x.provider==='Perplexity').estimated,false);
});
test('maximum two queries per configured provider and no silent substitution of failed provider',async()=>{
 let calls=0;const r=await collectAnswerEvidence(entity,{queries:['Suggest machining companies in Berlin.','Suggest tooling manufacturers in Munich.'],providers:['Gemini'],env:{OPENAI_API_KEY:'fixture',GEMINI_API_KEY:'fixture'},request:async()=>{calls++;throw Error('failure')},recordCost:async()=>{}});assert.equal(calls,2);assert.equal(r.observations.length,0);assert.equal(r.summary.neutralComplete,0);assert.equal(r.errors.length,2);
});
const storeSource=(await readFile(new URL('../lib/answer-evidence-store.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'').replace(/export /g,'');
const {measureAnswerEvidence}=new Function('compareAnswerEvidence',storeSource+';return {measureAnswerEvidence};')(compareAnswerEvidence);
function dbFixture({acquired=true,recent=false,insertFail=false}={}){const state={calls:[],collect:0,released:false};const tx={query:async(sql,p)=>{state.calls.push({sql,p});if(sql.includes('try_advisory'))return {rows:[{acquired}]};if(sql.startsWith('SELECT id FROM'))return {rows:recent?[{id:'prior'}]:[]};if(sql.startsWith('INSERT')){if(insertFail)throw Error('insert-failed');return {rows:[{id:'new',createdAt:'now'}]}};return {rows:[]}},release(){state.released=true}};return {state,deps:{pool:{connect:async()=>tx},guard:async()=>({mode:'normal'}),collect:async()=>{state.collect++;return {observations:[],errors:[{provider:'Gemini',error:'timeout'}],summary:answerSummary([],[{}])}}}}}
test('running/recent evidence blocks duplicate calls; successful evidence persists under transaction',async()=>{
 for(const opts of [{acquired:false},{recent:true}]){const f=dbFixture(opts);assert.ok((await measureAnswerEvidence(entity,{},f.deps)).skipped);assert.equal(f.state.collect,0);assert.equal(f.state.released,true);assert.equal(f.state.calls.at(-1).sql,'ROLLBACK')}
 const f=dbFixture();const r=await measureAnswerEvidence(entity,{},f.deps);assert.equal(r.id,'new');assert.equal(r.result.comparison.pairs.length,0);assert.match(r.result.comparison.scope,/API/);assert.equal(f.state.collect,1);assert.equal(f.state.calls.at(-1).sql,'COMMIT');assert.equal(JSON.parse(f.state.calls.find(x=>x.sql.startsWith('INSERT')).p[5]).summary.neutralComplete,0);
});
test('failed persistence rolls back and emergency budget causes no provider calls',async()=>{const f=dbFixture({insertFail:true});await assert.rejects(()=>measureAnswerEvidence(entity,{},f.deps));assert.equal(f.state.calls.at(-1).sql,'ROLLBACK');assert.equal(f.state.released,true);const g=dbFixture();g.deps.guard=async()=>({mode:'emergency'});assert.equal((await measureAnswerEvidence(entity,{},g.deps)).skipped,'ai-budget-exhausted');assert.equal(g.state.collect,0)});
