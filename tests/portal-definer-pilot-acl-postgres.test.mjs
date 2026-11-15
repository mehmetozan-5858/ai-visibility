import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {Pool} from 'pg';

// DESTRUCTIVE FIXTURE: disposable localhost PostgreSQL CI database only.
// Never point this test at production, staging, or a Neon branch.
const source=process.env.PORTAL_LOCK_RACE_DATABASE_URL;
if(source){
 const u=new URL(source);
 if(!['postgres:','postgresql:'].includes(u.protocol)||
    !['localhost','127.0.0.1'].includes(u.hostname)||
    u.pathname!=='/fixture'||decodeURIComponent(u.username)!=='fixture')
  throw Error('disposable-ci-postgres-only');
}
const dbName='ci_portal_definer_acl_review';
const owner='portal_report_fn_owner_ci_acl_review';
const reader='portal_gateway_reader_ci_acl_review';
const tenant='11111111-1111-4111-8111-111111111111';
const secret='synthetic-only-independent-ci-claim-signing-key';
const rpc='SELECT "authorized","tenantId","reports" FROM public.portal_verified_one_time_envelope_review($1::uuid,$2::bigint,$3::uuid,$4::text)';
function claim(){
 const nonce=randomUUID(),expires=Math.floor(Date.now()/1000)+45;
 const mac=createHmac('sha256',secret)
  .update('portal-one-time-report-v1|'+tenant+'|'+expires+'|'+nonce)
  .digest('hex');
 return [tenant,expires,nonce,mac];
}

test('NOLOGIN SQL definer requires pilot SELECT, while RPC-only LOGIN reader never gains raw access',{
 skip:!source?'requires disposable localhost PostgreSQL 16 fixture':false,
 timeout:35000
},async()=>{
 const admin=new Pool({connectionString:source,max:1});
 const target=new URL(source);target.pathname='/'+dbName;
 let db,created=false,ownerMade=false,readerMade=false;
 try{
  await admin.query('CREATE DATABASE '+dbName);created=true;
  db=new Pool({connectionString:target.toString(),max:2,query_timeout:8000});
  await db.query('CREATE SCHEMA portal_authz');
  await db.query('CREATE EXTENSION pgcrypto WITH SCHEMA portal_authz');
  await db.query('CREATE TABLE public.clients(id uuid PRIMARY KEY,status text NOT NULL)');
  await db.query('CREATE TABLE public.client_pilot_access(client_id uuid PRIMARY KEY,revoked_at timestamptz,expires_at timestamptz NOT NULL)');
  await db.query('CREATE TABLE public.ai_provider_comparisons(client_id uuid NOT NULL,query text NOT NULL,results jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now())');
  const migration=await readFile(new URL('../migrations/portal-one-time-explicit-envelope-review.sql',import.meta.url),'utf8');
  await db.query(migration);
  await admin.query('CREATE ROLE '+owner+' NOLOGIN');ownerMade=true;
  await admin.query('CREATE ROLE '+reader+' LOGIN');readerMade=true;
  // Owner-only scoped grants. Do NOT grant pilot SELECT before the negative test.
  await db.query('GRANT USAGE ON SCHEMA portal_authz TO '+owner);
  await db.query('GRANT SELECT ON portal_authz.signing_keys TO '+owner);
  await db.query('GRANT INSERT,SELECT ON portal_authz.consumed_claims TO '+owner);
  await db.query('GRANT SELECT ON public.clients,public.ai_provider_comparisons TO '+owner);
  await db.query('ALTER FUNCTION public.portal_verified_one_time_envelope_review(uuid,bigint,uuid,text) OWNER TO '+owner);
  await db.query('GRANT USAGE ON SCHEMA public TO '+reader);
  await db.query('GRANT EXECUTE ON FUNCTION public.portal_verified_one_time_envelope_review(uuid,bigint,uuid,text) TO '+reader);
  await db.query('INSERT INTO portal_authz.signing_keys(key_id,secret) VALUES($1,$2)',['review-v1',secret]);
  await db.query('INSERT INTO public.clients(id,status) VALUES($1,$2)',[tenant,'active']);
  await db.query("INSERT INTO public.client_pilot_access(client_id,expires_at) VALUES($1,now()+interval '1 hour')",[tenant]);

  const ownerRights=(await db.query(`SELECT rolcanlogin,
   has_table_privilege($1,'public.client_pilot_access','SELECT') AS pilot_select,
   has_table_privilege($1,'public.ai_provider_comparisons','SELECT') AS comparison_select
   FROM pg_roles WHERE rolname=$1`,[owner])).rows[0];
  assert.equal(ownerRights.rolcanlogin,false);
  assert.equal(ownerRights.pilot_select,false);
  assert.equal(ownerRights.comparison_select,true);
  // Test lacks a credentials table, so do not rely on querying its privileges.

  const conn=await db.connect();
  try{
   await conn.query('BEGIN');
   await conn.query('SET LOCAL ROLE '+reader);
   assert.equal((await conn.query('SELECT current_user AS who')).rows[0].who,reader);
   assert.equal((await conn.query("SELECT has_table_privilege(current_user,'public.ai_provider_comparisons','SELECT') AS can_select")).rows[0].can_select,false);
   await conn.query('SAVEPOINT direct_report_denied');
   await assert.rejects(conn.query('SELECT 1 FROM public.ai_provider_comparisons'),e=>e.code==='42501');
   await conn.query('ROLLBACK TO SAVEPOINT direct_report_denied');
   await conn.query('SAVEPOINT missing_pilot_grant');
   const first=claim();
   await assert.rejects(conn.query(rpc,first),e=>e.code==='42501',
    'separate NOLOGIN function owner must not silently inherit pilot SELECT');
   await conn.query('ROLLBACK TO SAVEPOINT missing_pilot_grant');
   assert.equal((await conn.query('SELECT current_user AS who')).rows[0].who,reader);
   await conn.query('COMMIT');
   assert.equal((await db.query('SELECT count(*)::int AS n FROM portal_authz.consumed_claims')).rows[0].n,0,
    'denial must not consume signed claim');
  }finally{
   await conn.query('ROLLBACK').catch(()=>{});
   conn.release();
  }

  // This grant exists ONLY in the disposable database. The public SQL reader
  // still receives no direct SELECT on clients, pilot or comparisons.
  await db.query('GRANT SELECT ON public.client_pilot_access TO '+owner);
  assert.equal((await db.query("SELECT has_table_privilege($1,'public.client_pilot_access','SELECT') AS allowed",[owner])).rows[0].allowed,true);
  const limited=await db.connect();
  try{
   await limited.query('BEGIN');
   await limited.query('SET LOCAL ROLE '+reader);
   const valid=claim();
   const accepted=(await limited.query(rpc,valid)).rows;
   assert.equal(accepted.length,1,'one authorized empty envelope');
   assert.equal(accepted[0].authorized,true);
   assert.equal(accepted[0].tenantId,tenant);
   assert.deepEqual(accepted[0].reports,[]);
   await limited.query('COMMIT');
   assert.deepEqual((await db.query(rpc,valid)).rows,[],'one-time replay denied');
   await db.query('UPDATE public.client_pilot_access SET revoked_at=now() WHERE client_id=$1',[tenant]);
   await limited.query('BEGIN');
   await limited.query('SET LOCAL ROLE '+reader);
   assert.deepEqual((await limited.query(rpc,claim())).rows,[],'revoked pilot denied');
   await limited.query('COMMIT');
  }finally{
   await limited.query('ROLLBACK').catch(()=>{});
   limited.release();
  }
 }finally{
  if(db)await db.end().catch(()=>{});
  if(created)await admin.query('DROP DATABASE '+dbName).catch(()=>{});
  if(readerMade)await admin.query('DROP ROLE IF EXISTS '+reader).catch(()=>{});
  if(ownerMade)await admin.query('DROP ROLE IF EXISTS '+owner).catch(()=>{});
  await admin.end();
 }
});
