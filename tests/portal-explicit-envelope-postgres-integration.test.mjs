import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {Pool} from 'pg';
import {createClientToken} from '../lib/admin-auth.js';
import {hashPassword,verifyHash} from '../lib/client-password-verifier.mjs';
import {issueExistingPasswordSessionReview} from '../lib/portal-existing-password-session-review.mjs';
import {createEnvelopeGatewayReview} from '../lib/portal-envelope-gateway-review.mjs';
import {createPortalReportHttpReview} from '../lib/portal-report-http-review.mjs';
import {createReviewReportEntitlementAuthority} from '../lib/one-time-report-authority-review.mjs';
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
const roleName='portal_gateway_reader_ci_envelope';
const ownerName='portal_report_fn_owner';
const rolePassword='synthetic-ci-only-local-reader-password';
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
 let created=false,roleCreated=false,ownerCreated=false;
 try{
  await admin.query('CREATE DATABASE '+dbName);created=true;
  db=new Pool({connectionString:target.toString(),max:4,connectionTimeoutMillis:2500,query_timeout:8000,statement_timeout:8000,idle_in_transaction_session_timeout:12000});
  // Real PostgreSQL fail-before-DDL acceptance: the mandatory NOLOGIN owner
  // must exist BEFORE this review migration may create its private schema.
  const migration=await readFile(new URL('../migrations/portal-one-time-explicit-envelope-review.sql',import.meta.url),'utf8');
  await assert.rejects(db.query(migration),error=>
   error.message.includes('review-report-function-owner-unverified'));
  // Clear the failed BEGIN transaction on the pooled backend before the
  // following catalog probe (and before disposable fixture DDL).
  await db.query('ROLLBACK');
  const beforeAnyDdl=(await db.query(
   "SELECT to_regnamespace('portal_authz') IS NOT NULL AS schema_exists, "+
   "to_regprocedure('public.portal_verified_one_time_envelope_review(uuid,bigint,uuid,text)') IS NOT NULL AS rpc_exists"
  )).rows[0];
  assert.deepEqual(beforeAnyDdl,{schema_exists:false,rpc_exists:false},
   'missing owner must leave no schema and no SECURITY DEFINER function');
  await db.query('CREATE SCHEMA portal_authz');
  await db.query('CREATE TABLE public.clients(id uuid PRIMARY KEY,status text NOT NULL)');
  await db.query('CREATE TABLE public.client_credentials(client_id uuid PRIMARY KEY)');
  await db.query('CREATE TABLE public.payments(id uuid PRIMARY KEY)');
  await db.query('CREATE TABLE public.verified_customer_settlements(id uuid PRIMARY KEY)');
  await db.query('CREATE TABLE public.client_pilot_access(client_id uuid PRIMARY KEY, revoked_at timestamptz, expires_at timestamptz NOT NULL)');
  await db.query('CREATE TABLE public.ai_provider_comparisons(client_id uuid NOT NULL,query text NOT NULL,results jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp())');
  // Only the disposable CI cluster gets this NOLOGIN function owner. The
  // migration itself MUST continue rejecting missing/unverified owners.
  await admin.query('CREATE ROLE '+ownerName+' NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS');
  ownerCreated=true;
  await db.query('GRANT USAGE ON SCHEMA public,portal_authz TO '+ownerName);
  await db.query('GRANT SELECT ON public.clients,public.client_pilot_access,public.ai_provider_comparisons TO '+ownerName);
  // Once the role and sensitive-table checks pass, a missing private pgcrypto
  // HMAC must still fail BEFORE creating any signing/nonce tables or RPC.
  await assert.rejects(db.query(migration),error=>
   error.message.includes('review-report-hmac-placement-unverified'));
  await db.query('ROLLBACK');
  const absentCryptoObjects=(await db.query(
   "SELECT to_regclass('portal_authz.signing_keys') IS NOT NULL AS keys_exist, "+
   "to_regclass('portal_authz.consumed_claims') IS NOT NULL AS claims_exist, "+
   "to_regprocedure('public.portal_verified_one_time_envelope_review(uuid,bigint,uuid,text)') IS NOT NULL AS rpc_exists"
  )).rows[0];
  assert.deepEqual(absentCryptoObjects,{keys_exist:false,claims_exist:false,rpc_exists:false},
   'missing private HMAC cannot leave any signed-envelope artifacts');
  // A lookalike HMAC with matching signature but no pgcrypto extension
  // membership is never trusted, even when it can be executed.
  await db.query(`CREATE FUNCTION portal_authz.hmac(bytea,bytea,text)
    RETURNS bytea LANGUAGE SQL IMMUTABLE AS $fake$ SELECT $1 $fake$`);
  await assert.rejects(db.query(migration),error=>
   error.message.includes('review-report-hmac-placement-unverified'));
  await db.query('ROLLBACK');
  const spoofState=(await db.query(
   "SELECT to_regclass('portal_authz.signing_keys') IS NOT NULL AS keys_exist, "+
   "to_regclass('portal_authz.consumed_claims') IS NOT NULL AS claims_exist, "+
   "to_regprocedure('public.portal_verified_one_time_envelope_review(uuid,bigint,uuid,text)') IS NOT NULL AS rpc_exists"
  )).rows[0];
  assert.deepEqual(spoofState,{keys_exist:false,claims_exist:false,rpc_exists:false},
   'same-name fake HMAC cannot create report signing or claim artifacts');
  await db.query('DROP FUNCTION portal_authz.hmac(bytea,bytea,text)');
  await db.query('CREATE EXTENSION pgcrypto WITH SCHEMA portal_authz');
  // signing_keys/consumed_claims tables are made by the migration below;
  // grant their minimum required privileges only after it has completed.

  await db.query(migration);
  await db.query(`GRANT SELECT ON TABLE portal_authz.signing_keys TO ${ownerName}`);
  await db.query(`GRANT INSERT ON TABLE portal_authz.consumed_claims TO ${ownerName}`);
  // RETURNING claim_id on a one-use INSERT needs read access to that column;
  // do not grant unrestricted table SELECT to the function owner.
  await db.query(`GRANT SELECT (claim_id) ON TABLE portal_authz.consumed_claims TO ${ownerName}`);

  // Role is synthetic and cluster-scoped to this disposable CI PostgreSQL.
  // Grant EXECUTE only; no direct SELECT on report or private claim ledger.
  await admin.query("CREATE ROLE "+roleName+" LOGIN PASSWORD '"+rolePassword+"'");roleCreated=true;
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

  // PUBLIC execute must really be revoked: a separate LOGIN role without
  // the explicit RPC grant must be denied even with a valid signed claim.
  // Uses SET LOCAL ROLE inside this disposable PostgreSQL fixture only.
  const noExecuteRole='portal_gateway_reader_ci_noexecute';
  await admin.query('CREATE ROLE '+noExecuteRole+' LOGIN');
  try{
   const restrictedNoGrant=await db.connect();
   try{
    await restrictedNoGrant.query('BEGIN');
    await restrictedNoGrant.query('SET LOCAL ROLE '+noExecuteRole);
    const right=(await restrictedNoGrant.query(`SELECT has_function_privilege(
      current_user,'public.portal_verified_one_time_envelope_review(uuid,bigint,uuid,text)',
      'EXECUTE') AS can_execute`)).rows[0];
    assert.equal(right.can_execute,false,'PUBLIC may not execute signed report RPC');
    await restrictedNoGrant.query('SAVEPOINT denied_rpc_execute');
    const deniedNonce=randomUUID(),deniedExpires=Math.floor(Date.now()/1000)+60;
    await assert.rejects(restrictedNoGrant.query(rpc,
      [A,deniedExpires,deniedNonce,sign(A,deniedExpires,deniedNonce)]),
      error=>error.code==='42501');
    await restrictedNoGrant.query('ROLLBACK TO SAVEPOINT denied_rpc_execute');
    await restrictedNoGrant.query('COMMIT');
    assert.equal((await db.query(
      'SELECT count(*)::int AS n FROM portal_authz.consumed_claims WHERE claim_id=$1',
      [deniedNonce])).rows[0].n,0,'unauthorized reader cannot consume a claim');
   }finally{
    await restrictedNoGrant.query('ROLLBACK').catch(()=>{});
    restrictedNoGrant.release();
   }
  }finally{
   await admin.query('DROP ROLE '+noExecuteRole);
  }

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
  // Full synthetic signed session -> trusted authority preflight -> restricted
  // reader role -> real SQL SECURITY DEFINER RPC -> envelope acceptance.
  // Entire path is review-only; no HTTP route and no live Neon credentials.
  const keys=['AUTH_SECRET','PORTAL_REPORT_CLAIM_SECRET','PORTAL_REPORT_READER_ROLE'];
  const original=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  try{
   process.env.AUTH_SECRET='synthetic-http-session-ci-only-secret';
   process.env.PORTAL_REPORT_CLAIM_SECRET=SECRET;
   process.env.PORTAL_REPORT_READER_ROLE=roleName;
   const limitedUrl=new URL(target.toString());
   limitedUrl.username=roleName;limitedUrl.password=rolePassword;
   const readerPool=new Pool({connectionString:limitedUrl.toString(),
    max:2,connectionTimeoutMillis:2500,query_timeout:8000,statement_timeout:8000});
   try{
    // Verify real LOGIN identity cannot SELECT the raw report, payment,
    // customer credentials, or the private signing/claim ledgers.
    const auditConn=await readerPool.connect();
    try{
     const identity=(await auditConn.query('SELECT current_user AS name')).rows[0];
     assert.equal(identity.name,roleName);
     const canCreate=(await auditConn.query(
      "SELECT has_database_privilege(current_user,current_database(),'CREATE') AS allowed"
     )).rows[0].allowed;
     assert.equal(canCreate,false,
      'RPC-only customer report reader cannot create schemas/functions in database');
     await auditConn.query('BEGIN');
     for(const query of [
      'SELECT 1 FROM public.ai_provider_comparisons LIMIT 1',
      'SELECT 1 FROM public.client_credentials LIMIT 1',
      'SELECT 1 FROM public.payments LIMIT 1',
      'SELECT 1 FROM public.verified_customer_settlements LIMIT 1',
      'SELECT 1 FROM portal_authz.signing_keys LIMIT 1',
      'SELECT 1 FROM portal_authz.consumed_claims LIMIT 1',
      "UPDATE portal_authz.signing_keys SET secret='forged-key' WHERE key_id='review-v1'",
      "DELETE FROM portal_authz.signing_keys WHERE key_id='review-v1'",
      `INSERT INTO portal_authz.consumed_claims(claim_id,tenant_id,expires_at)
        VALUES('33333333-3333-4333-8333-333333333333',
        '11111111-1111-4111-8111-111111111111',1999999999)`,
      "DELETE FROM portal_authz.consumed_claims WHERE tenant_id='11111111-1111-4111-8111-111111111111'"
     ]){
      await auditConn.query('SAVEPOINT forbidden_reader_probe');
      await assert.rejects(auditConn.query(query),error=>error.code==='42501',
       'privileged report reader unexpectedly accessed forbidden table');
      await auditConn.query('ROLLBACK TO SAVEPOINT forbidden_reader_probe');
     }
     // Even if the login sets an arbitrary tenant GUC, it cannot SELECT
     // another tenant's raw rows. The only permitted report surface is
     // the signed, one-time SECURITY DEFINER RPC with a verified identity.
     await auditConn.query('SAVEPOINT forged_tenant_guc_probe');
     await auditConn.query("SELECT set_config('app.tenant_id',$1,true)",[B]);
     await assert.rejects(
      auditConn.query('SELECT client_id,query FROM public.ai_provider_comparisons WHERE client_id=$1',[B]),
      error=>error.code==='42501',
      'forged tenant GUC cannot expose raw reports');
     await auditConn.query('ROLLBACK TO SAVEPOINT forged_tenant_guc_probe');
     await auditConn.query('COMMIT');
    }finally{
     await auditConn.query('ROLLBACK').catch(()=>{});
     auditConn.release();
    }
    const gateway=createEnvelopeGatewayReview({
     reportPool:readerPool,
     entitlementAuthority:createReviewReportEntitlementAuthority(db)
    });
    // Disposable real PostgreSQL negative probe: even an unrelated
    // SECURITY DEFINER function with PUBLIC EXECUTE must fail role
    // readiness BEFORE the signed report RPC is attempted.
    await db.query(`CREATE FUNCTION public.portal_unexpected_definer_ci()
      RETURNS integer LANGUAGE sql SECURITY DEFINER AS $fn$ SELECT 1; $fn$`);
    try{
     await db.query('GRANT EXECUTE ON FUNCTION public.portal_unexpected_definer_ci() TO PUBLIC');
     await assert.rejects(
      gateway(await createClientToken(A)),/review-envelope-role-unverified/,
      'unexpected callable security definer must block signed report reader');
    }finally{
     await db.query('DROP FUNCTION public.portal_unexpected_definer_ci()');
    }

    // Real disposable PostgreSQL role-membership escalation check: reject
    // report reader identity even when inherited privileges are not currently
    // exercised. PG role memberships can permit future SET ROLE escalation.
    const syntheticMemberRole='portal_reader_member_ci';
    await admin.query('CREATE ROLE '+syntheticMemberRole+' NOLOGIN');
    try{
     await admin.query('GRANT '+syntheticMemberRole+' TO '+roleName);
     await assert.rejects(
      gateway(await createClientToken(A)),/review-envelope-role-unverified/,
      'a report reader with alternate role membership must fail closed');
    }finally{
     await admin.query('REVOKE '+syntheticMemberRole+' FROM '+roleName).catch(()=>{});
     await admin.query('DROP ROLE '+syntheticMemberRole).catch(()=>{});
    }

    // Full review acceptance: the signed session MUST originate from
    // unchanged existing-password verification, not a direct test token.
    // All data is synthetic. No real user credential is read or reset.
    const existingPassword='synthetic-existing-customer-password-no-reset';
    const existingHash=hashPassword(existingPassword);
    let verificationCalls=0;
    const verifyExisting=async(email,input)=>{
     verificationCalls++;
     return email==='owner@example.test'&&verifyHash(input,existingHash)
      ?{clientId:A,email:'owner@example.test'}:null;
    };
    const http=createPortalReportHttpReview(gateway);
    const wrongSession=await issueExistingPasswordSessionReview({
     email:'owner@example.test',password:'wrong-existing-password',
     verifyExisting
    });
    assert.equal(wrongSession,null);
    const wrongResponse=await http(wrongSession||'');
    assert.equal(wrongResponse.status,401);
    assert.equal(wrongResponse.headers.get('Cache-Control'),'private, no-store, max-age=0');
    const verifiedSession=await issueExistingPasswordSessionReview({
     email:'OWNER@EXAMPLE.TEST',password:existingPassword,verifyExisting
    });
    assert.ok(verifiedSession,'only verified existing password can create session');
    assert.equal(verifyHash(existingPassword,existingHash),true);
    assert.equal(verificationCalls,2);
    assert.deepEqual(await gateway(verifiedSession),[],
     'existing-password session must reach restricted role and signed empty-report RPC');
    // HTTP adapter + verified password-derived session + disposable PG role/RPC:
    // a valid empty report must be 200, never cached, and authorized.
    const authorizedResponse=await http(verifiedSession);
    assert.equal(authorizedResponse.status,200);
    assert.equal(authorizedResponse.headers.get('Cache-Control'),
     'private, no-store, max-age=0');
    assert.deepEqual(await authorizedResponse.json(),{authorized:true,evidenceClass:'historical',verifiedProviderEvidence:false,reports:[]});
    const invalidResponse=await http('invalid-signed-customer-session');
    assert.equal(invalidResponse.status,401);
    assert.deepEqual(await invalidResponse.json(),{error:'customer-session-required'});

    await assert.rejects(gateway(await createClientToken(B)),
     /review-envelope-entitlement-denied/,
     'expired synthetic tenant must be denied before report connection');
    // Simulate a stale *server-side* preflight: the authoritative SQL RPC
    // must reject a revocation committed before its tenant lock/read.
    const staleAuthority=async tenant=>({tenantId:tenant,active:true,
     source:'verified-pilot',checkedAt:Date.now()});
    const staleGateway=createEnvelopeGatewayReview({
     reportPool:readerPool,entitlementAuthority:staleAuthority
    });
    await db.query("UPDATE public.client_pilot_access SET revoked_at=clock_timestamp() WHERE client_id=$1",[A]);
    const claimsBefore=(await db.query('SELECT count(*)::int AS n FROM portal_authz.consumed_claims')).rows[0].n;
    await assert.rejects(staleGateway(await createClientToken(A)),
     /report-envelope-authorization-unproven/,
     'committed revoke MUST override even a passing preflight');
    const revokedResponse=await createPortalReportHttpReview(staleGateway)(
     await createClientToken(A));
    assert.equal(revokedResponse.status,503);
    assert.deepEqual(await revokedResponse.json(),{error:'verified-report-unavailable'});
    const claimsAfter=(await db.query('SELECT count(*)::int AS n FROM portal_authz.consumed_claims')).rows[0].n;
    assert.equal(claimsAfter,claimsBefore,
     'denied stale-preflight request cannot consume a one-use claim');
    await db.query("UPDATE public.client_pilot_access SET revoked_at=NULL WHERE client_id=$1",[A]);
    // A stale preflight must also fail when the account is suspended AFTER
    // authorization but BEFORE the SQL RPC evaluates current account state.
    await db.query("UPDATE public.clients SET status='payment-review' WHERE id=$1",[A]);
    const beforeSuspend=(await db.query('SELECT count(*)::int AS n FROM portal_authz.consumed_claims')).rows[0].n;
    await assert.rejects(staleGateway(await createClientToken(A)),
     /report-envelope-authorization-unproven/,
     'committed account suspension MUST override stale pilot preflight');
    const afterSuspend=(await db.query('SELECT count(*)::int AS n FROM portal_authz.consumed_claims')).rows[0].n;
    assert.equal(afterSuspend,beforeSuspend,
     'denied suspended account cannot consume a one-use claim');
    await db.query("UPDATE public.clients SET status='active' WHERE id=$1",[A]);
   }finally{
    await readerPool.end();
   }
  }finally{
   for(const key of keys){
    if(original[key]===undefined)delete process.env[key];
    else process.env[key]=original[key];
   }
  }
  // Secret rotation is a separate production approval gate. Prove the SQL
  // verifier rejects an old, otherwise valid signature after rotation,
  // without burning its one-time nonce. Entirely disposable CI key/DB.
  const rotatedSecret='different-synthetic-rotated-key-for-ci-only';
  const rotationNonce=randomUUID(),rotationExpiry=Math.floor(Date.now()/1000)+60;
  const oldMac=sign(A,rotationExpiry,rotationNonce);
  await db.query("UPDATE portal_authz.signing_keys SET secret=$1 WHERE key_id='review-v1'",
   [rotatedSecret]);
  assert.deepEqual((await db.query(rpc,[A,rotationExpiry,rotationNonce,oldMac])).rows,[],
   'old signature must fail after isolated key rotation');
  assert.equal((await db.query(
   'SELECT count(*)::int AS n FROM portal_authz.consumed_claims WHERE claim_id=$1',
   [rotationNonce])).rows[0].n,0,
   'a rotated-out claim must not consume the nonce');
  const newMac=createHmac('sha256',rotatedSecret)
   .update('portal-one-time-report-v1|'+A+'|'+rotationExpiry+'|'+rotationNonce).digest('hex');
  assert.equal((await db.query(rpc,[A,rotationExpiry,rotationNonce,newMac])).rows.length,1,
   'new signing secret must authorize exactly one envelope');
  assert.deepEqual((await db.query(rpc,[A,rotationExpiry,rotationNonce,newMac])).rows,[],
   'new signed claim remains one-use');
  await db.query("UPDATE portal_authz.signing_keys SET secret=$1 WHERE key_id='review-v1'",
   [SECRET]);

  const empty=await call(A);
  assert.deepEqual(decodeAuthorizedReportEnvelopeReview(empty,A),{authorized:true,reports:[]});
  await db.query("INSERT INTO public.ai_provider_comparisons(client_id,query,results) VALUES($1,'Synthetic report A','[]'::jsonb)",[A]);
  const populated=await call(A);
  assert.equal(decodeAuthorizedReportEnvelopeReview(populated,A).reports.length,1);
  assert.equal(populated[0].reports[0].query,'Synthetic report A');

  // A valid signed claim is bound to exactly its signed tenant, even when
  // the target tenant is otherwise active and has report entitlement.
  // A copied A signature with B's UUID cannot authorize B or spend its nonce.
  await db.query("UPDATE public.client_pilot_access SET expires_at=clock_timestamp()+interval '1 hour' WHERE client_id=$1",[B]);
  const stolenNonce=randomUUID(),stolenExpires=Math.floor(Date.now()/1000)+60;
  const stolenMac=sign(A,stolenExpires,stolenNonce);
  assert.deepEqual((await db.query(rpc,[B,stolenExpires,stolenNonce,stolenMac])).rows,[],
   'cross-tenant signed MAC must not authorize a second active tenant');
  assert.equal((await db.query(
   'SELECT count(*)::int AS n FROM portal_authz.consumed_claims WHERE claim_id=$1',
   [stolenNonce])).rows[0].n,0,'cross-tenant forgery cannot consume a nonce');
  assert.equal((await db.query(rpc,[A,stolenExpires,stolenNonce,stolenMac])).rows.length,1,
   'the original tenant still owns the unconsumed signed claim');
  await db.query("UPDATE public.client_pilot_access SET expires_at=clock_timestamp()-interval '1 second' WHERE client_id=$1",[B]);

  assert.deepEqual(await call(B),[],'expired pilot must not produce an authorized envelope');
  assert.deepEqual(await call(A,{mac:'0'.repeat(64)}),[],'bad HMAC must deny');
  const nonce=randomUUID();
  assert.equal((await call(A,{nonce})).length,1);
  assert.deepEqual(await call(A,{nonce}),[],'replay must not produce a second envelope');
  // Two independent connections racing the SAME nonce may authorize once,
  // never twice. The second concurrent request sees the consumed claim.
  const simultaneousNonce=randomUUID(),simultaneousExpires=Math.floor(Date.now()/1000)+60;
  const simultaneousMac=sign(A,simultaneousExpires,simultaneousNonce);
  const raced=await Promise.all([
   db.query(rpc,[A,simultaneousExpires,simultaneousNonce,simultaneousMac]),
   db.query(rpc,[A,simultaneousExpires,simultaneousNonce,simultaneousMac])
  ]);
  assert.deepEqual(raced.map(x=>x.rows.length).sort(),[0,1],
   'concurrent same-nonce requests must yield one envelope only');
  assert.equal((await db.query(
   'SELECT count(*)::int AS n FROM portal_authz.consumed_claims WHERE claim_id=$1',
   [simultaneousNonce])).rows[0].n,1,'one-time claim ledger must remain unique');

  await db.query("UPDATE public.clients SET status='payment-review' WHERE id=$1",[A]);
  assert.deepEqual(await call(A),[],'suspended account must deny');
  await db.query("UPDATE public.clients SET status='active' WHERE id=$1",[A]);
  await db.query("UPDATE public.client_pilot_access SET revoked_at=clock_timestamp() WHERE client_id=$1",[A]);
  assert.deepEqual(await call(A),[],'revoked pilot must deny');

  // Review-only, real disposable two-backend transaction: an account
  // suspension writer taking the tenant lock must block a signed report
  // and the reader must see committed suspension before using its nonce.
  // Production confirmPayment/suspension writers are NOT yet coordinated.
  await db.query("UPDATE public.client_pilot_access SET revoked_at=NULL WHERE client_id=$1",[A]);
  const accountWriter=await db.connect();
  const accountReader=await db.connect();
  const accountObserver=await db.connect();
  let accountWriting=false,accountReading=false;
  try{
   await accountWriter.query('BEGIN ISOLATION LEVEL READ COMMITTED');
   accountWriting=true;
   await accountWriter.query(PILOT_LOCK_SQL,[A]);
   await accountWriter.query("UPDATE public.clients SET status='payment-review' WHERE id=$1",[A]);
   await accountReader.query('BEGIN ISOLATION LEVEL READ COMMITTED');
   accountReading=true;
   await accountReader.query("SET LOCAL lock_timeout = '5000ms'");
   const accountReaderPid=(await accountReader.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
   const accountNonce=randomUUID(),accountExpiry=Math.floor(Date.now()/1000)+60;
   const accountPending=accountReader.query(rpc,[A,accountExpiry,accountNonce,
    sign(A,accountExpiry,accountNonce)]);
   accountPending.catch(()=>{});
   let waitedOnAccountLock=false;
   for(let i=0;i<120;i++){
    const state=await accountObserver.query(
     'SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[accountReaderPid]);
    if(state.rows[0]?.wait_event_type==='Lock'){waitedOnAccountLock=true;break}
    await wait(25);
   }
   assert.equal(waitedOnAccountLock,true,
    'signed report must wait for account-suspension tenant lock');
   await accountWriter.query('COMMIT');accountWriting=false;
   assert.deepEqual((await accountPending).rows,[],
    'fresh post-lock account state must deny suspended tenant');
   await accountReader.query('COMMIT');accountReading=false;
   assert.equal((await accountObserver.query(
    'SELECT count(*)::int AS n FROM portal_authz.consumed_claims WHERE claim_id=$1',
    [accountNonce])).rows[0].n,0,
    'a suspended account must not spend its signed one-use claim');
  }finally{
   if(accountWriting)await accountWriter.query('ROLLBACK').catch(()=>{});
   if(accountReading)await accountReader.query('ROLLBACK').catch(()=>{});
   accountWriter.release();accountReader.release();accountObserver.release();
  }
  await db.query("UPDATE public.clients SET status='active' WHERE id=$1",[A]);

  // Reverse direction: once an authorized signed report obtains its tenant
  // lock, an account-state writer must wait until the report transaction ends.
  // This is a disposable PostgreSQL lock protocol test, not payment execution.
  const reportFirst=await db.connect(),accountSecond=await db.connect(),
   reverseObserver=await db.connect();
  let holdingReport=false,holdingAccount=false;
  try{
   await reportFirst.query('BEGIN ISOLATION LEVEL READ COMMITTED');
   holdingReport=true;
   const reverseNonce=randomUUID(),reverseExpiry=Math.floor(Date.now()/1000)+60;
   const reverseReport=(await reportFirst.query(rpc,[A,reverseExpiry,reverseNonce,
    sign(A,reverseExpiry,reverseNonce)])).rows;
   assert.equal(reverseReport.length,1,
    'report must have its tenant lock before the account writer starts');
   await accountSecond.query('BEGIN ISOLATION LEVEL READ COMMITTED');
   holdingAccount=true;
   await accountSecond.query("SET LOCAL lock_timeout = '5000ms'");
   const writerPid=(await accountSecond.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
   const pendingAccount=(async()=>{
    await accountSecond.query(PILOT_LOCK_SQL,[A]);
    await accountSecond.query("UPDATE public.clients SET status='payment-review' WHERE id=$1",[A]);
   })();
   pendingAccount.catch(()=>{});
   let writerBlocked=false;
   for(let i=0;i<120;i++){
    const state=await reverseObserver.query(
     'SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[writerPid]);
    if(state.rows[0]?.wait_event_type==='Lock'){writerBlocked=true;break}
    await wait(25);
   }
   assert.equal(writerBlocked,true,
    'account-state writer must wait behind in-flight authorized report');
   assert.equal((await reverseObserver.query(
    'SELECT status FROM public.clients WHERE id=$1',[A])).rows[0].status,
    'active','uncommitted account change must remain invisible');
   await reportFirst.query('COMMIT');holdingReport=false;
   await pendingAccount;
   await accountSecond.query('COMMIT');holdingAccount=false;
   assert.equal((await reverseObserver.query(
    'SELECT status FROM public.clients WHERE id=$1',[A])).rows[0].status,
    'payment-review','writer must commit only after signed report finishes');
  }finally{
   if(holdingReport)await reportFirst.query('ROLLBACK').catch(()=>{});
   if(holdingAccount)await accountSecond.query('ROLLBACK').catch(()=>{});
   reportFirst.release();accountSecond.release();reverseObserver.release();
  }
  await db.query("UPDATE public.clients SET status='active' WHERE id=$1",[A]);

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
   // Observe failure even if an earlier assertion exits before awaiting.
   pending.catch(()=>{});
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
   // The reader may be waiting for the writer's advisory lock. Release the
   // writer FIRST, otherwise a failed assertion can deadlock test cleanup.
   if(writing)await writer.query('ROLLBACK').catch(()=>{});
   if(reading)await reader.query('ROLLBACK').catch(()=>{});
   writer.release();reader.release();observer.release();
  }
 }finally{
  if(db)await db.end().catch(()=>{});
  if(created)await admin.query('DROP DATABASE '+dbName).catch(()=>{});
  if(roleCreated)await admin.query('DROP ROLE IF EXISTS '+roleName).catch(()=>{});
  if(ownerCreated)await admin.query('DROP ROLE IF EXISTS '+ownerName).catch(()=>{});
  await admin.end();
 }
});