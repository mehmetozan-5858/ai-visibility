import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {freeAssessmentEvidence} from '../lib/free-assessment-rules.js';
import {createFreeAssessmentToken,verifyFreeAssessmentToken,freeAssessmentUrl} from '../lib/free-assessment-token.js';
import {permissionEnquiry,outreachApproach,outreachSubject,safeFirstContact,outreachExperimentVariant} from '../lib/outreach-quality.js';
import {servicePrice,formatMoney} from '../lib/regional-pricing.js';
import {verifyAdminToken,verifyClientToken,verifyPaymentAccessToken} from '../lib/admin-auth.js';
import {recipientScopeIssue} from '../lib/recipient-scope.js';
const id='12345678-1234-1234-1234-123456789012',now=Date.now(),secret='test-purpose-key';
const entity={id,domain:'example.com'};
const observation=(provider,query,brandMentioned=true)=>({provider,query,brandMentioned,brandPrompted:false,truncated:false,model:'model',mode:'search',text:'Recorded response'});
const observations=['ChatGPT','Gemini','Perplexity'].flatMap(provider=>['question one','question two'].map((q,i)=>observation(provider,q,i===0)));
const run=(obs=observations)=>({entityId:id,entityType:'prospect',domain:entity.domain,createdAt:new Date(now).toISOString(),result:{observations:obs}});
test('tokens are purpose-bound, expire, reject tampering and keep credentials in fragment',async()=>{
 const token=createFreeAssessmentToken(id,{secret,now,ttl:600});assert.equal(verifyFreeAssessmentToken(token,{secret,now}).prospectId,id);
 assert.equal(verifyFreeAssessmentToken(token,{secret,now:now+601000}),null);
 for(const value of [token+'x',token.replace(id,'87654321-1234-1234-1234-123456789012'),token.replace('free-assessment','client'),token.split('.').slice(0,3).join('.')+'.'+'é'.repeat(43)])assert.equal(verifyFreeAssessmentToken(value,{secret,now}),null);
 const url=new URL(freeAssessmentUrl(id,{secret,now,base:'https://example.com'}));assert.equal(url.search,'');assert.match(url.hash,/token=/);
 const oldSecret=process.env.AUTH_SECRET,oldPassword=process.env.ADMIN_PASSWORD;process.env.AUTH_SECRET=secret;process.env.ADMIN_PASSWORD='test-only';
 try{assert.equal(await verifyAdminToken(token),false);assert.equal(await verifyClientToken(token),null);assert.equal(await verifyPaymentAccessToken(token),null)}finally{if(oldSecret===undefined)delete process.env.AUTH_SECRET;else process.env.AUTH_SECRET=oldSecret;if(oldPassword===undefined)delete process.env.ADMIN_PASSWORD;else process.env.ADMIN_PASSWORD=oldPassword}
});
test('scores require sufficient distinct recent unbiased complete samples',()=>{
 const ready=freeAssessmentEvidence(entity,[run()],{now});assert.equal(ready.score,50);assert.equal(ready.samples,6);
 for(const r of [run(observations.slice(0,5)),run(observations.map(o=>({...o,provider:'only'}))),run(observations.map(o=>({...o,query:'same'}))),run(observations.map(o=>({...o,brandPrompted:true}))),run(observations.map(o=>({...o,truncated:true}))),{...run(),entityId:'another'},{...run(),domain:'other.com'},{...run(),createdAt:new Date(now-15*86400000).toISOString()},{...run(),createdAt:new Date(now+1000).toISOString()}])assert.equal(freeAssessmentEvidence(entity,[r],{now}).score,null);
 assert.equal(freeAssessmentEvidence(entity,[run(),run(observations.map(o=>({...o,model:'other'})))],{now}).samples,6);
 const newer={...run(observations.map(o=>({...o,brandMentioned:false}))),createdAt:new Date(now+1000).toISOString()};assert.equal(freeAssessmentEvidence(entity,[run(),newer],{now:now+1000}).score,0);
 assert.equal(JSON.stringify(ready).includes('Recorded response'),false);
});
test('four sector approaches preserve benefit, free/paid terms and exact reviewed copy',()=>{
 for(const [sector,expected] of [['General services','discovery'],['Industrial packaging manufacturing','buyer'],['Diş kliniği','local'],['E-ticaret mağazası','product']]){
  assert.equal(outreachApproach({sector}),expected);
  for(const country of ['Türkiye','Germany']){const x={name:'Example',country,sector,city:'Test city'};const draft=permissionEnquiry(x);assert.equal(safeFirstContact({...x,outreachDraft:draft}),true);assert.equal(safeFirstContact({...x,outreachDraft:draft+' 25/100 guaranteed'}),false);assert.match(draft,country==='Türkiye'?/ücretli raporla/:/paid report/);assert.match(draft,country==='Türkiye'?/yeterli ölçüm varsa/:/sufficient evidence/);assert.doesNotMatch(outreachSubject({...x,name:'Example\r\nBcc:bad'}),/[\r\n]/)}
 }
});
const source=(await readFile(new URL('../app/api/free-assessment/route.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'').replace(/export /g,'');
function apiFixture({tables=true,fail=false}={}){
 const state={queries:[]};const pool={query:async(sql,args)=>{state.queries.push({sql,args});if(fail)throw Error('private-error');if(sql.includes('to_regclass'))return{rows:[{prospects:tables?'prospects':null,evidence:tables?'evidence':null}]};if(sql.includes('FROM prospects'))return{rows:[{...entity,name:'Example',country:'Germany',city:'Berlin',sector:'Manufacturing',contactEmail:'private@example.com',qualificationScore:100}]};return{rows:[run()]}}};
 const GET=new Function('verifyFreeAssessmentToken','freeAssessmentEvidence','databasePool','getDatabaseUrl','checkRateLimit','servicePrice',source+';return GET;')(token=>verifyFreeAssessmentToken(token,{secret,now}),freeAssessmentEvidence,()=>pool,()=> 'test-db',()=>null,x=>({code:x.service,name:'Plan',amount:119,currency:'EUR',kind:'one-time'}));
 return{GET,state};
}
const req=token=>new Request('https://example.com/api/free-assessment',{headers:token?{'x-preview-token':token}:{}});
test('public endpoint authenticates before reads and exposes only free aggregates',async()=>{
 const {GET,state}=apiFixture();assert.equal((await GET(req())).status,401);assert.equal(state.queries.length,0);
 const r=await GET(req(createFreeAssessmentToken(id,{secret,now})));assert.equal(r.status,200);const body=await r.json();assert.equal(body.assessment.score,50);assert.equal(body.business.contactEmail,undefined);assert.equal(body.business.qualificationScore,undefined);assert.doesNotMatch(JSON.stringify(body),/Recorded response|private@example.com/);
 assert.ok(state.queries.every(x=>!/\b(INSERT|UPDATE|CREATE|ALTER|DELETE)\b/i.test(x.sql)));assert.equal(state.queries[1].args[0],id);assert.equal(r.headers.get('cache-control'),'no-store');
});
test('source failures do not fabricate a zero score',async()=>{
 for(const options of [{tables:false},{fail:true}]){const {GET}=apiFixture(options);const r=await GET(req(createFreeAssessmentToken(id,{secret,now})));assert.equal(r.status,503);assert.equal((await r.json()).assessment,undefined)}
});
const emailSource=(await readFile(new URL('../lib/outreach-email.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'').replace(/export /g,'');
const {buildBrandedOutreachEmail,sendBrandedOutreach}=new Function('safeFirstContact','outreachSubject','outreachExperimentVariant','freeAssessmentUrl','deliverOnce','process','servicePrice','formatMoney','recipientScopeIssue',emailSource+';return {buildBrandedOutreachEmail,sendBrandedOutreach};')(safeFirstContact,outreachSubject,outreachExperimentVariant,id=>freeAssessmentUrl(id,{secret,now,base:'https://example.com'}),async(key,payload,finalize)=>{await finalize('test-provider');return{key,payload}},{env:{RESEND_API_KEY:'test-only',EMAIL_FROM:'info@example.com'}},servicePrice,formatMoney,recipientScopeIssue);
test('future emails include the scoped free screen and sector subject without live transmission',async()=>{
 const x={id,name:'Example <Business>',sector:'Manufacturing',country:'Germany',contactEmail:'info@example.com',firstContact:true};x.outreachDraft=permissionEnquiry(x);
 const result=await sendBrandedOutreach(x,{key:'test-key',finalize:async()=>{}});assert.equal(result.payload.subject,outreachSubject(x));assert.match(result.payload.html,/on-degerlendirme#token=/);assert.match(result.payload.html,/View your free assessment/);assert.doesNotMatch(result.payload.html,/<Business>/);assert.equal(result.experimentVariant,'A');
 await assert.rejects(()=>sendBrandedOutreach({...x,outreachDraft:'Invented score: 1/100'},{key:'test-key',finalize:async()=>{}}),/quality/);
 assert.match(buildBrandedOutreachEmail({...x,followContact:true}).subject,/follow-up/);
});

test('variant A keeps first-touch prices while variant B defers numeric prices until follow-up',()=>{
 const controlId='12345678-1234-1234-1234-123456789012',conversionId='e1075e85-d15a-422a-9ac9-6d8f3daa6eef';
 assert.equal(outreachExperimentVariant(controlId),'A');assert.equal(outreachExperimentVariant(conversionId),'B');
 const base={name:'Example',sector:'Manufacturing',country:'Germany',firstContact:true,outreachDraft:'Reviewed message'};
 const price=formatMoney(servicePrice({service:'business-diagnosis',country:'Germany'}).amount,'EUR','en-GB');
 assert.ok(buildBrandedOutreachEmail({...base,id:controlId}).html.includes(price));
 assert.ok(!buildBrandedOutreachEmail({...base,id:conversionId}).html.includes(price));
 assert.ok(buildBrandedOutreachEmail({...base,id:conversionId,followContact:true}).html.includes(price));
});

test('priced variant and follow-up use canonical regional prices and currencies',()=>{
 for(const [country,currency] of [['Türkiye','TRY'],['Germany','EUR'],['United Kingdom','GBP'],['United States','USD'],['Saudi Arabia','USD']]){
  for(const followContact of [false,true]){const x={id, name:'Example',sector:'Manufacturing',country,firstContact:true,followContact,outreachDraft:'Reviewed message'};const mail=buildBrandedOutreachEmail(x);for(const service of ['business-diagnosis','business-monitoring']){const p=servicePrice({service,country});assert.equal(p.currency,currency);assert.ok(mail.html.includes(formatMoney(p.amount,p.currency,country==='Türkiye'?'tr-TR':'en-GB')))}assert.match(mail.html,country==='Türkiye'?/tek sefer/:/one time/);assert.match(mail.html,country==='Türkiye'?/\/ ay/:/\/ month/)}
 }
});