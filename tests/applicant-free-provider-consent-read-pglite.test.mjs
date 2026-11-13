import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {readApplicantProviderConsent} from '../lib/applicant-free-provider-consent-read.mjs';
const lead='11111111-1111-4111-8111-111111111111';
const prospect='22222222-2222-4222-8222-222222222222';
const scope={prospectId:prospect,businessDomain:'example.test',provider:'OpenRouter'};
async function create(db){
 await db.exec(`CREATE TABLE public.customer_leads(id UUID PRIMARY KEY,email TEXT NOT NULL);
 CREATE TABLE public.prospects(id UUID PRIMARY KEY,domain TEXT NOT NULL);
 CREATE TABLE public.lead_email_challenges(lead_id UUID,email TEXT,verified_at timestamptz,consumed_at timestamptz);
 CREATE TABLE public.applicant_assessment_links(lead_id UUID,prospect_id UUID,verified_domain TEXT,verified_at timestamptz,revoked_at timestamptz);
 INSERT INTO public.customer_leads VALUES ('${lead}','applicant@example.test');
 INSERT INTO public.prospects VALUES ('${prospect}','example.test');
 INSERT INTO public.lead_email_challenges VALUES ('${lead}','applicant@example.test',NOW(),NOW());
 INSERT INTO public.applicant_assessment_links VALUES ('${lead}','${prospect}','example.test',NOW(),NULL);`);
 await db.exec(await readFile(new URL('../migrations/applicant-free-provider-consents-review.sql',import.meta.url),'utf8'));
}
async function grant(db){
 await db.query(`INSERT INTO public.applicant_free_provider_consents
  (lead_id,prospect_id,provider,purpose,policy_version,source,granted_at,expires_at)
  VALUES ($1,$2,'OpenRouter','free-ai-assessment','2026-11-policy',
    'verified-applicant-action',NOW()-INTERVAL '1 minute',NOW()+INTERVAL '1 day')`,[lead,prospect]);
}
test('only a current applicant action consent joined to exact verified domain/email grants one provider',async()=>{
 const db=new PGlite();
 try{
  await create(db);
  assert.equal((await readApplicantProviderConsent(db,scope)).authorized,false);
  await grant(db);
  assert.equal((await readApplicantProviderConsent(db,scope)).authorized,true);
  assert.equal((await readApplicantProviderConsent(db,{...scope,provider:'Gemini'})).authorized,false);
  assert.equal((await readApplicantProviderConsent(db,{...scope,businessDomain:'other.test'})).authorized,false);
  assert.equal((await readApplicantProviderConsent(db,{...scope,prospectId:'33333333-3333-4333-8333-333333333333'})).authorized,false);
  await db.query('UPDATE public.applicant_free_provider_consents SET revoked_at=NOW()');
  assert.equal((await readApplicantProviderConsent(db,scope)).authorized,false);
 }finally{await db.close();}
});
test('unverified email, revoked link, missing schema and expired consent fail closed',async()=>{
 for(const sql of [
  'UPDATE public.lead_email_challenges SET verified_at=NULL',
  'UPDATE public.applicant_assessment_links SET revoked_at=NOW()',
  `UPDATE public.applicant_free_provider_consents SET expires_at=NOW()-INTERVAL '1 second'`
 ]){
  const db=new PGlite();
  try{await create(db);await grant(db);await db.exec(sql);
   assert.equal((await readApplicantProviderConsent(db,scope)).authorized,false);
  }finally{await db.close();}
 }
 const db=new PGlite();
 try{
  assert.equal((await readApplicantProviderConsent(db,scope)).authorized,false);
  assert.equal((await readApplicantProviderConsent(null,scope)).authorized,false);
 }finally{await db.close();}
});
