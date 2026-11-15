import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {Pool} from 'pg';
import {PILOT_LOCK_SQL} from '../lib/portal-pilot-advisory-lock-review.mjs';
import {decodeAuthorizedReportEnvelopeReview} from '../lib/portal-explicit-report-envelope-review.mjs';

// DDL is restricted to a new disposable LOCAL PostgreSQL 16 CI database.
// Never connect this destructive fixture to Neon, staging or production.
const source=process.env.PORTAL_LOCK_RACE_DATABASE_URL;
if(source){
 const u=new URL(source);
 if(!['postgres:','postgresql:'].includes(u.protocol)||
    !['localhost','127.0.0.1'].includes(u.hostname)||
    u.pathname!=='/fixture'||decodeURIComponent(u.username)!=='fixture')
  throw Error('disposable-ci-postgres-only');
}
const dbName='ci_portal_envelope_review';
const roleName='ci_portal_envelope_reader';
const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const SECRET='fixture-synthetic-report-secret-not-for-live-use';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const sign=(tenant,expiry,nonce)=>createHmac('sha256',SECRET)
 .update('portal-one-time-report-v1|'+tenant+'|'+expiry+'|'+nonce).digest('hex');

test('real isolated SQL RPC differentiates denial, authorized empty, replay, expiry and revocation',{
 skip:!source?'requires disposable local PostgreSQL service':false,
 timeout:35000
},async()=>{
 const admin=new Pool({connectionString:source,max:1,connectionTimeoutMillis:2500,query_timeout:8000,statement_timeout:8000});
 const target=new URL(source);target.pathname='/'+dbName;
 let db;
 let created=false,roleCreated=false;
 try{
  await admin.query('CREATE DATABASE '+dbName);created=true;
  db=new Pool({connectionString:target.toString(),max:4,connectionTimeoutMillis:2500,query_timeout:8000,statement_timeout:8000,idle_in_transaction_session_timeout:12000});
  await db.query('CREATE SCHEMA portal_authz');
  await db.query('CREATE EXTENSION pgcrypto WITH SCHEMA portal_authz');
  await db.query('CREATE TABLE public.clients(id uuid PRIMARY KEY,status text NOT NULL)');
  await db.query('CREATE TABLE public.client_pilot_access(client_id uuid PRIMARY KEY, revoked_at timestamptz, expires_at timestamptz NOT NULL)');
  await db.query('CREATE TABLE public.ai_provider_comparisons(client_id uuid NOT NULL,query text NOT NULL,results jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp())');
  const migration=await readFile(new URL('../migrations/portal-one-time-explicit-envelope-review.sql',import.meta.url),'utf8');
  await db.query(migration);
  // Role is synthetic and cluster-scoped to this disposable CI PostgreSQL.
  // Grant EXECUTE only; no direct SELECT on report or private claim ledger.
  await admin.query('CREATE ROLE '+roleName+' NOLOGIN');roleCreated=true;
  await db.query('GRANT USAGE ON SCHEMA public TO '+roleName);
  await db.query('GRANT EXECUTE ON FUNCTION public.portal_verified_one_time_envelope_review(uuid,bigint,uuid,text) TO '+roleName);
  const limited=await db.connect();
  try{
   await limited.query('BEGIN');
   await limited.query('SET LOCAL ROLE '+roleName);
   const rights=(await limited.query(`SELECT current_user AS who,
    has_function_privilege(current_user,
      'public.portal_verified_one_time_envelope_review(uuid,bigint,uuid,text)','EXECUTE') AS can_execute,
    has_table_privilege(current_user,'public.ai_provider_comparisons','SELECT') AS raw_select,
    has_schema_privilege(current_user,'portal_authz','USAGE') AS private_usage`)).rows[0];
   assert.equal(rights.who,roleName);
   assert.equal(rights.can_execute,true);
   for(const field of ['raw_select','private_usage'])
    assert.equal(rights[field],false,'unexpected privilege: '+field);
   // A hidden schema cannot even be name-resolved for has_table_privilege.
   // Probe actual SELECT within a savepoint and require permission rejection.
   await limited.query('SAVEPOINT denied_private_select');
   await assert.rejects(limited.query('SELECT secret FROM portal_authz.signing_keys LIMIT 1'),
    err=>err.code==='42501');
   await limited.query('ROLLBACK TO SAVEPOINT denied_private_select');
   await limited.query('COMMIT');
  }finally{
   await limited.query('ROLLBACK').catch(()=>{});
   limited.release();
  }
  await db.query("INSERT INTO portal_authz.signing_keys(key_id,secret) VALUES('review-v1',$1)",[SECRET]);
  await db.query("INSERT INTO public.clients(id,status) VALUES($1,'active'),($2,'active')",[A,B]);
  await db.query("INSERT INTO public.client_pilot_access(client_id,expires_at) VALUES($1,clock_timestamp()+interval '1 hour'),($2,clock_timestamp()-interval '1 second')",[A,B]);
  const rpc='SELECT "authorized","tenantId","reports" FROM public.portal_verified_one_time_envelope_review($1::uuid,$2::bigint,$3::uuid,$4::text)';
  const call=async(tenant,{nonce=randomUUID(),mac,expires=Math.floor(Date.now()/1000)+60}={})=>
   (await db.query(rpc,[tenant,expires,nonce,mac??sign(tenant,expires,nonce)])).rows;

  // Execute the actual SECURITY DEFINER RPC as the narrowly privileged role.
  // This is more than a metadata check: the role cannot SELECT raw report rows.
  const restricted=await db.connect();
  try{
   await restricted.query('BEGIN ISOLATION LEVEL READ COMMITTED');
   await restricted.query('SET LOCAL ROLE '+roleName);
   const restrictedNonce=randomUUID(),restrictedExpiry=Math.floor(Date.now()/1000)+60;
   const limitedResult=await restricted.query(rpc,
    [A,restrictedExpiry,restrictedNonce,sign(A,restrictedExpiry,restrictedNonce)]);
   assert.deepEqual(decodeAuthorizedReportEnvelopeReview(limitedResult.rows,A),
    {authorized:true,reports:[]});
   await restricted.query('COMMIT');
  }finally{
   await restricted.query('ROLLBACK').catch(()=>{});
   restricted.release();
  }
  const empty=await call(A);
  assert.deepEqual(decodeAuthorizedReportEnvelopeReview(empty,A),{authorized:true,reports:[]});
  await db.query("INSERT INTO public.ai_provider_comparisons(client_id,query,results) VALUES($1,'Synthetic report A','[]'::jsonb)",[A]);
  const populated=await call(A);
  assert.equal(decodeAuthorizedReportEnvelopeReview(populated,A).reports.length,1);
  assert.equal(populated[0].reports[0].query,'Synthetic report A');

  assert.deepEqual(await call(B),[],'expired pilot must not produce an authorized envelope');
  assert.deepEqual(await call(A,{mac:'0'.repeat(64)}),[],'bad HMAC must deny');
  const nonce=randomUUID();
  assert.equal((await call(A,{nonce})).length,1);
  assert.deepEqual(await call(A,{nonce}),[],'replay must not produce a second envelope');
  await db.query("UPDATE public.clients SET status='payment-review' WHERE id=$1",[A]);
  assert.deepEqual(await call(A),[],'suspended account must deny');
  await db.query("UPDATE public.clients SET status='active' WHERE id=$1",[A]);
  await db.query("UPDATE public.client_pilot_access SET revoked_at=clock_timestamp() WHERE client_id=$1",[A]);
  assert.deepEqual(await call(A),[],'revoked pilot must deny');

  // New active pilot, but writer revokes it while the signed report waits:
  // the report must take the same tenant advisory lock and then see revocation.
  await db.query("UPDATE public.client_pilot_access SET revoked_at=NULL WHERE client_id=$1",[A]);
  const writer=await db.connect(),reader=await db.connect(),observer=await db.connect();
  let writing=false,reading=false;
  try{
   await writer.query('BEGIN ISOLATION LEVEL READ COMMITTED');writing=true;
   await writer.query(PILOT_LOCK_SQL,[A]);
   await writer.query("UPDATE public.client_pilot_access SET revoked_at=clock_timestamp() WHERE client_id=$1",[A]);
   await reader.query('BEGIN ISOLATION LEVEL READ COMMITTED');reading=true;
   await reader.query("SET LOCAL lock_timeout = '5000ms'");
   const readerPid=(await reader.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
   const nextNonce=randomUUID(),expires=Math.floor(Date.now()/1000)+60;
   const pending=reader.query(rpc,[A,expires,nextNonce,sign(A,expires,nextNonce)]);
   let blocked=false;
   for(let i=0;i<120;i++){
    const q=await observer.query("SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1",[readerPid]);
    if(q.rows[0]?.wait_event_type==='Lock'){blocked=true;break}
    await wait(25);
   }
   assert.equal(blocked,true,'report RPC must wait on genuine writer lock');
   await writer.query('COMMIT');writing=false;
   assert.deepEqual((await pending).rows,[]);
   await reader.query('COMMIT');reading=false;
   const ledger=await observer.query('SELECT count(*)::int AS n FROM portal_authz.consumed_claims WHERE claim_id=$1',[nextNonce]);
   assert.equal(ledger.rows[0].n,0,'revoked report must not consume signed claim');
  }finally{
   if(reading)await reader.query('ROLLBACK').catch(()=>{});
   if(writing)await writer.query('ROLLBACK').catch(()=>{});
   writer.release();reader.release();observer.release();
  }
 }finally{
  if(db)await db.end().catch(()=>{});
  if(created)await admin.query('DROP DATABASE '+dbName).catch(()=>{});
  if(roleCreated)await admin.query('DROP ROLE IF EXISTS '+roleName).catch(()=>{});
  await admin.end();
 }
});