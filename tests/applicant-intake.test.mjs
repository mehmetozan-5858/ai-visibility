import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {prepareApplicantBusiness} from '../lib/applicant-intake.mjs';
const leadId='11111111-1111-4111-8111-111111111111';
async function fixture(){
 const db=new PGlite();await db.exec(`CREATE TABLE customer_leads(id uuid primary key,business_name text,website text,email text,sector text,country text);
 CREATE TABLE lead_email_challenges(lead_id uuid,email text,verified_at timestamptz,consumed_at timestamptz);
 CREATE TABLE prospects(id uuid primary key,name text,domain text,sector text,city text,country text,source text);
 INSERT INTO customer_leads VALUES('${leadId}','Own Test','https://www.example.com/','test@example.com','Software','Türkiye');
 INSERT INTO lead_email_challenges VALUES('${leadId}','test@example.com',NOW(),NOW());`);
 const locks=[];const pool={connect:async()=>({release(){},query:async(sql,args)=>{
  if(sql.startsWith('SELECT pg_advisory_xact_lock')){locks.push(args[0]);return {rows:[]}}return db.query(sql,args);
 }})};return {db,pool,locks};
}
test('verified intake creates once, reuses canonical domain, and grants no access',async()=>{
 const {db,pool,locks}=await fixture();try{
  const first=await prepareApplicantBusiness(pool,leadId),second=await prepareApplicantBusiness(pool,leadId);
  assert.equal(first.created,true);assert.equal(second.created,false);assert.equal(first.prospectId,second.prospectId);
  assert.equal(first.domain,'example.com');assert.equal(first.accessGranted,false);assert.equal(first.providerCalled,false);assert.equal(first.ownershipVerified,false);
  assert.deepEqual(locks,['example.com','example.com']);assert.equal((await db.query('SELECT count(*) AS n FROM prospects')).rows[0].n,1);
 }finally{await db.close()}
});
test('email verification must match the current lead email and be consumed',async()=>{
 const {db,pool}=await fixture();try{
  await db.exec("UPDATE lead_email_challenges SET consumed_at=NULL");
  await assert.rejects(prepareApplicantBusiness(pool,leadId),/verified-email-and-domain-required/);
  await db.exec("UPDATE lead_email_challenges SET consumed_at=NOW(),email='other@example.com'");
  await assert.rejects(prepareApplicantBusiness(pool,leadId),/verified-email-and-domain-required/);
  assert.equal((await db.query('SELECT count(*) AS n FROM prospects')).rows[0].n,0);
 }finally{await db.close()}
});
test('ambiguous normalized candidates reject without another business',async()=>{
 const {db,pool}=await fixture();try{
  await db.exec("INSERT INTO prospects(id,domain) VALUES('22222222-2222-4222-8222-222222222222','example.com'),('33333333-3333-4333-8333-333333333333','https://www.example.com/')");
  await assert.rejects(prepareApplicantBusiness(pool,leadId),/ambiguous-business/);
  assert.equal((await db.query('SELECT count(*) AS n FROM prospects')).rows[0].n,2);
 }finally{await db.close()}
});
