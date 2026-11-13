import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PDFDocument} from 'pdf-lib';
import {buildApplicantAssessmentPdf} from '../lib/applicant-assessment-pdf.mjs';

test('free PDF supports Turkish names, bounds long input and refuses a score on insufficient samples',async()=>{
 for(const business of [{name:'Işık Şirketi - Çözüm Geliştirme',country:'Türkiye',city:'Şişli',sector:'Sağlık'},{name:'W'.repeat(500),country:'W'.repeat(500),city:'W'.repeat(500),sector:'W'.repeat(500)}]){
  const bytes=await buildApplicantAssessmentPdf({business,assessment:{status:'ready',score:100,samples:1,providers:1,queries:1,measuredAt:'2026-11-12T16:12:27Z'}});
  assert.equal(Buffer.from(bytes).subarray(0,5).toString(),'%PDF-');
  const pdf=await PDFDocument.load(bytes);assert.ok(pdf.getPageCount()>=1&&pdf.getPageCount()<=2);assert.match(pdf.getTitle(),/Ücretsiz/);
 }
});
const source=(await readFile(new URL('../app/api/applicant-assessment/route.js',import.meta.url),'utf8')).replace(/^import .*;\s*$/gm,'').replace(/export /g,'');
function fixture({grant=true,ownership=true,limited=false,renderFail=false,proofStatus="insufficient",proofSamples=0}={}){
 const state={reads:0,renders:0};
 const pool={query:async sql=>{state.reads++;return {rows:sql.includes('FROM public.applicant_assessment_links')?[{id:'owned-prospect',name:'Owned business',country:'Türkiye',website:'example.com',domain:'example.com',verifiedDomain:ownership?'example.com':'other.com',emailVerifiedAt:'now',emailConsumedAt:'now',email:'private@example.com'}]:[]}}};
 const GET=new Function('verifyApplicantAssessmentGrant','linkedApplicantAssessmentEnabled','normalizedBusinessDomain','readVerifiedFreeApplicantAssessment','databasePool','getDatabaseUrl','checkRateLimit','buildApplicantAssessmentPdf',source+';return GET;')(
  ()=>grant?{leadId:'owned-lead',prospectId:'owned-prospect'}:null,()=>true,x=>x,()=>({score:null,status:proofStatus,samples:proofSamples,providers:proofSamples?1:0,queries:proofSamples?1:0}),()=>pool,()=> 'db',()=>limited?new Response(null,{status:429}):null,
  async input=>{state.renders++;assert.equal(input.business.email,undefined);assert.equal(input.assessment.score,null);if(renderFail)throw Error('private-error');return new Uint8Array([37,80,68,70,45]);}
 );return {GET,state};
}
const req=format=>new Request('https://example.com/api/applicant-assessment'+(format?'?format='+format:''),{headers:{'x-applicant-assessment-token':'fixture-only'}});
test('PDF format authenticates and rechecks live ownership before rendering, with private headers on all outcomes',async()=>{
 for(const [options,status] of [[{grant:false},401],[{ownership:false},403],[{limited:true},429],[{renderFail:true},503],[{},200]]){
  const {GET,state}=fixture(options),r=await GET(req('pdf'));assert.equal(r.status,status);assert.match(r.headers.get('cache-control'),/private.*no-store/);assert.equal(r.headers.get('vary'),'x-applicant-assessment-token');
  if(!options.grant&&options.grant!==undefined)assert.equal(state.reads,0);
  if(options.ownership===false||options.limited)assert.equal(state.renders,0);
  if(status===200){assert.equal(r.headers.get('content-type'),'application/pdf');assert.match(r.headers.get('content-disposition'),/^attachment; filename="ai-visibility-free-assessment.pdf"$/);}
  else assert.doesNotMatch(await r.text(),/private-error|private@example/);
 }
});
test('JSON preview never renders a PDF, and unsupported formats cannot select other data',async()=>{
 const {GET,state}=fixture();assert.equal((await GET(req('html'))).status,400);assert.equal(state.reads,0);
 const r=await GET(req());assert.equal(r.status,200);assert.equal(state.renders,0);assert.equal((await r.json()).paidAccess,false);
});

test('applicant JSON and PDF reject missing verified evidence and never read historical answer runs',async()=>{
 for(const proofStatus of ['unavailable','insufficient']){
  const {GET,state}=fixture({proofStatus,proofSamples:proofStatus==='insufficient'?2:100});
  const json=await GET(req());
  assert.equal(json.status,200);
  const body=await json.json();
  assert.equal(body.assessment.status,'insufficient');
  assert.equal(body.assessment.score,null);
  assert.equal(body.assessment.samples,proofStatus==='unavailable'?0:2);
  assert.equal((await GET(req('pdf'))).status,200);
  assert.equal(state.renders,1);
 }
 const route=await readFile(new URL('../app/api/applicant-assessment/route.js',import.meta.url),'utf8');
 assert.doesNotMatch(route,/answer_evidence_runs|freeAssessmentEvidence\(row,runs\)/);
});
