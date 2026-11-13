import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {readApplicantProviderConsent} from '../lib/applicant-free-provider-consent-read.mjs';
const path='../app/api/applicant-provider-consent/route.js';
const src=await readFile(new URL(path,import.meta.url),'utf8');
test('applicant permission endpoint is explicit, scope checked, opt-in and withdraw only',()=>{
 assert.match(src,/verifyApplicantAssessmentGrant/);
 assert.match(src,/enforceSameOrigin\(req\)/);
 assert.match(src,/APPLICANT_FREE_PROVIDER_CONSENT_ENABLED/);
 assert.match(src,/a\.revoked_at IS NULL/);
 assert.match(src,/row\.emailVerifiedAt/);
 assert.match(src,/row\.emailConsumedAt/);
 assert.match(src,/verifiedDomain!==row\.verifiedDomain/);
 assert.match(src,/agree-to-openrouter-data-permission/);
 assert.match(src,/withdraw-openrouter-data-permission/);
 assert.doesNotMatch(src,/runFreeBridgeTask|collectAndPersistVerifiedFreeApplicant|checkout|sendApplicantAssessmentLink/);
 const component=src;
 assert.match(component,/startsProviderRequest:false/);
});
test('browser permission is opt-in only and includes provider disclosure and withdrawal',async()=>{
 const component=await readFile(new URL('../components/ApplicantAssessment.js',import.meta.url),'utf8');
 assert.match(component,/type="checkbox" checked=\{permissionChecked\}/);
 assert.match(component,/disabled=\{!permissionChecked\|\|permissionBusy/);
 assert.match(component,/changeProviderPermission\(true\)/);
 assert.match(component,/OpenRouter may transmit/);
 assert.doesNotMatch(component,/useEffect\(\(\)=>changeProviderPermission/);
});
test('signed applicant action persists consent and withdraws with PostgreSQL semantics',async()=>{
 const db=new PGlite();
 try{
  const lead='11111111-1111-4111-8111-111111111111';
  const prospect='22222222-2222-4222-8222-222222222222';
  await db.exec(`CREATE TABLE public.customer_leads(id UUID PRIMARY KEY,email TEXT NOT NULL,website TEXT NOT NULL);
   CREATE TABLE public.prospects(id UUID PRIMARY KEY,domain TEXT NOT NULL);
   CREATE TABLE public.lead_email_challenges(lead_id UUID,email TEXT,verified_at timestamptz,consumed_at timestamptz);
   CREATE TABLE public.applicant_assessment_links(lead_id UUID,prospect_id UUID,verified_domain TEXT,verified_at timestamptz,revoked_at timestamptz);
   INSERT INTO public.customer_leads VALUES ('${lead}','applicant@example.test','https://example.test/');
   INSERT INTO public.prospects VALUES ('${prospect}','example.test');
   INSERT INTO public.lead_email_challenges VALUES ('${lead}','applicant@example.test',NOW(),NOW());
   INSERT INTO public.applicant_assessment_links VALUES ('${lead}','${prospect}','example.test',NOW(),NULL);`);
  await db.exec(await readFile(new URL('../migrations/applicant-free-provider-consents-review.sql',import.meta.url),'utf8'));
  const js=src.replace(/^import .*;\s*$/gm,'').replace(/export /g,'');
  const dbPool=()=>db;
  const readGrant=()=>({leadId:lead,prospectId:prospect});
  const route=new Function('verifyApplicantAssessmentGrant','normalizedBusinessDomain','databasePool','getDatabaseUrl','checkRateLimit','enforceSameOrigin','process',js+';return {POST,DELETE};')(
   readGrant,website=>{try{return new URL(website).hostname.replace(/^www\./,'')}catch{return website}},
   dbPool,()=> 'test-db',()=>null,()=>null,{env:{APPLICANT_FREE_PROVIDER_CONSENT_ENABLED:'true'}});
  const request=(confirm)=>new Request('https://example.test/api/applicant-provider-consent',{
   method:'POST',headers:{'content-type':'application/json','x-applicant-assessment-token':'test'},
   body:JSON.stringify({provider:'OpenRouter',policyVersion:'provider-data-sharing-2026-11',confirm})});
  const success=await route.POST(request('agree-to-openrouter-data-permission'));
  assert.equal(success.status,200);
  assert.equal((await success.json()).startsProviderRequest,false);
  const scope={prospectId:prospect,businessDomain:'example.test',provider:'OpenRouter'};
  assert.equal((await readApplicantProviderConsent(db,scope)).authorized,true);
  const revoke=new Request('https://example.test/api/applicant-provider-consent',{
   method:'DELETE',headers:{'content-type':'application/json','x-applicant-assessment-token':'test'},
   body:JSON.stringify({provider:'OpenRouter',policyVersion:'provider-data-sharing-2026-11',
    confirm:'withdraw-openrouter-data-permission'})});
  const result=await route.DELETE(revoke);
  assert.equal(result.status,200);
  assert.equal((await readApplicantProviderConsent(db,scope)).authorized,false);
  assert.equal((await route.POST(request('bad-confirmation'))).status,400);
 }finally{await db.close();}
});
