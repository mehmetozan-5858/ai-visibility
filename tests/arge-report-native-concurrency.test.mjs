import test,{before,beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import pg from 'pg';
import {createStoredRevenuePreview} from '../lib/arge-report-repository.mjs';
import {prepareAuthorizedLaunchPlan} from '../lib/ai-visibility-launch-authorized-plan.mjs';
import {LAUNCH_SERVICES} from '../lib/ai-visibility-launch-services.mjs';

// Explicit opt-in: this suite must NEVER connect to a real customer database.
// It runs against an ephemeral, local PostgreSQL service in GitHub Actions.
const connectionString=process.env.ARGE_NATIVE_PG_TEST_URL;
if(!connectionString){
 test('native PostgreSQL concurrency acceptance (requires isolated arge_ci database)',{
  skip:'No ARGE_NATIVE_PG_TEST_URL; PGlite tests remain in npm test'
 },()=>{});
}else{
 const url=new URL(connectionString);
 if(!['127.0.0.1','localhost'].includes(url.hostname) ||
    decodeURIComponent(url.pathname)!=='/arge_ci' ||
    decodeURIComponent(url.username)!=='arge_ci' ||
    // Only the fixed synthetic CI fixture is permitted; reject real credentials.
    url.password!=='ci-only-ephemeral-postgres-fixture' ||
    url.search || url.hash || url.protocol!=='postgres:'){
  throw Error('Refusing non-local or non-isolated PostgreSQL test database');
 }
 const {Pool}=pg;
 const pool=new Pool({connectionString,max:12,connectionTimeoutMillis:5000});
 const schema=await readFile(new URL('../migrations/20261026_arge_report_previews.sql',import.meta.url),'utf8');
 const context=(tenantId,requestId)=>({
  pool,session:{clientId:tenantId},accountClientId:tenantId,requestId,
  featureEnabled:true,globallyEnabled:true
 });
 before(async()=>{
  await pool.query(schema);
  await pool.query(schema);
 });
 beforeEach(async()=>{
  await pool.query(`TRUNCATE arge_report_previews,arge_audit_events,arge_revenue_ledger,
   arge_entitlements,arge_memberships;
   INSERT INTO arge_memberships VALUES
    ('tenant1','tenant1','owner',true),('tenant2','tenant2','owner',true);
   INSERT INTO arge_entitlements(tenant_id,service_id,status,expires_at) VALUES
    ('tenant1','agent-audit-control','active','2099-01-01'),
    ('tenant2','agent-audit-control','active','2099-01-01');
   INSERT INTO arge_revenue_ledger VALUES
    ('tenant1','expected','e1','sub1','source1','2026-10','EUR','100'),
    ('tenant1','invoiced','i1','sub1','source2','2026-10','EUR','90'),
    ('tenant2','expected','e2','sub2','source3','2026-10','EUR','250');`);
 });
 after(async()=>{await pool.end();});

 test('eight independent connections racing on one request persist exactly one report and audit',async()=>{
  const results=await Promise.all(Array.from({length:8},()=>createStoredRevenuePreview(context('tenant1','race1'))));
  assert.ok(results.every(r=>r.ok===true));
  assert.equal(new Set(results.map(r=>r.reportId)).size,1);
  assert.equal(new Set(results.map(r=>r.auditEventId)).size,1);
  assert.equal(results.filter(r=>r.replayed===false).length,1);
  assert.equal(results.filter(r=>r.replayed===true).length,7);
  const rows=(await pool.query(`SELECT r.tenant_id,r.request_id,a.tenant_id AS audit_tenant
   FROM arge_report_previews r JOIN arge_audit_events a ON a.id=r.audit_event_id`)).rows;
  assert.deepEqual(rows.map(r=>[r.tenant_id,r.request_id,r.audit_tenant]),[['tenant1','race1','tenant1']]);
  assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM arge_audit_events')).rows[0].n,1);
 });

 test('concurrent same request IDs across tenants keep distinct reports and audit evidence',async()=>{
  const jobs=Array.from({length:6},(_,i)=>createStoredRevenuePreview(
   context(i%2===0?'tenant1':'tenant2','shared-request')));
  const results=await Promise.all(jobs);
  assert.ok(results.every(r=>r.ok===true));
  const t1=results.filter(r=>r.report.tenantId==='tenant1');
  const t2=results.filter(r=>r.report.tenantId==='tenant2');
  assert.equal(t1.length,3);assert.equal(t2.length,3);
  assert.equal(new Set(t1.map(r=>r.reportId)).size,1);
  assert.equal(new Set(t2.map(r=>r.reportId)).size,1);
  assert.notEqual(t1[0].reportId,t2[0].reportId);
  assert.notEqual(t1[0].auditEventId,t2[0].auditEventId);
  assert.equal(t1[0].report.comparisons[0].subscriptionId,'sub1');
  assert.equal(t2[0].report.comparisons[0].subscriptionId,'sub2');
  const rows=(await pool.query(`SELECT tenant_id,COUNT(*)::int AS n FROM arge_report_previews
   GROUP BY tenant_id ORDER BY tenant_id`)).rows;
  assert.deepEqual(rows.map(r=>[r.tenant_id,r.n]),[['tenant1',1],['tenant2',1]]);
  assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM arge_audit_events')).rows[0].n,2);
 });

 test('parallel distinct requests cannot exceed durable 30-report daily limit',async()=>{
  const results=await Promise.all(Array.from({length:34},(_,i)=>
   createStoredRevenuePreview(context('tenant1','quota'+i))));
  assert.equal(results.filter(r=>r.ok===true).length,30);
  assert.equal(results.filter(r=>r.reason==='preview-daily-limit').length,4);
  assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM arge_report_previews')).rows[0].n,30);
  assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM arge_audit_events')).rows[0].n,30);
 });

 test('native PostgreSQL upgrades a populated legacy audit index without losing reports',async()=>{
  const original=await createStoredRevenuePreview(context('tenant1','upgrade-existing'));
  assert.equal(original.ok,true);
  await pool.query('DROP INDEX arge_report_previews_tenant_audit_unique');
  try{
   // A pre-existing legacy table can have evidence but lack the new unique index.
   await pool.query(schema);
   const rows=(await pool.query(`SELECT r.id,r.tenant_id,r.audit_event_id,a.tenant_id AS audit_tenant
    FROM arge_report_previews r JOIN arge_audit_events a ON a.id=r.audit_event_id`)).rows;
   assert.deepEqual(rows.map(row=>[row.id,row.tenant_id,row.audit_event_id,row.audit_tenant]),
    [[original.reportId,'tenant1',original.auditEventId,'tenant1']]);
   const replay=await createStoredRevenuePreview(context('tenant1','upgrade-existing'));
   assert.equal(replay.ok,true);
   assert.equal(replay.replayed,true);
   assert.equal(replay.reportId,original.reportId);
   assert.equal(replay.auditEventId,original.auditEventId);
   assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM arge_audit_events')).rows[0].n,1);
  }finally{
   // Restore the isolated test schema even if an assertion fails.
   await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS arge_report_previews_tenant_audit_unique ON arge_report_previews(tenant_id,audit_event_id)');
  }
 });

 test('native PostgreSQL rejects a legacy nonunique index and rolls back without deleting evidence',async()=>{
  const original=await createStoredRevenuePreview(context('tenant1','invalid-index-existing'));
  assert.equal(original.ok,true);
  await pool.query('DROP INDEX arge_report_previews_tenant_audit_unique');
  await pool.query('CREATE INDEX arge_report_previews_tenant_audit_unique ON arge_report_previews(tenant_id,audit_event_id)');
  try{
   await assert.rejects(pool.query(schema),/arge_report_previews_tenant_audit_unique is missing or invalid/);
   const rows=(await pool.query('SELECT id,tenant_id,audit_event_id FROM arge_report_previews')).rows;
   assert.deepEqual(rows.map(row=>[row.id,row.tenant_id,row.audit_event_id]),
    [[original.reportId,'tenant1',original.auditEventId]]);
   assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM arge_audit_events')).rows[0].n,1);
   const indexes=(await pool.query(`SELECT ix.indisunique FROM pg_index ix
    JOIN pg_class idx ON idx.oid=ix.indexrelid
    WHERE idx.relname='arge_report_previews_tenant_audit_unique'`)).rows;
   assert.equal(indexes.length,1);
   assert.equal(indexes[0].indisunique,false);
  }finally{
   await pool.query('DROP INDEX IF EXISTS arge_report_previews_tenant_audit_unique');
   await pool.query(schema);
  }
 });
 test('native PostgreSQL rejects legacy tables without tenant request uniqueness',async()=>{
  const existing=await createStoredRevenuePreview(context('tenant1','legacy-request'));
  assert.equal(existing.ok,true);
  await pool.query('ALTER TABLE arge_report_previews DROP CONSTRAINT arge_report_previews_tenant_id_request_id_key');
  try{
   await assert.rejects(pool.query(schema),/tenant request uniqueness is missing or invalid/);
   const reports=(await pool.query('SELECT id,tenant_id,request_id,audit_event_id FROM arge_report_previews')).rows;
   assert.deepEqual(reports.map(row=>[row.id,row.tenant_id,row.request_id,row.audit_event_id]),
    [[existing.reportId,'tenant1','legacy-request',existing.auditEventId]]);
   assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM arge_audit_events')).rows[0].n,1);
  }finally{
   await pool.query('ALTER TABLE arge_report_previews ADD CONSTRAINT arge_report_previews_tenant_id_request_id_key UNIQUE (tenant_id,request_id)');
  }
  await pool.query(schema);
 });

 test('native PostgreSQL rejects nullable legacy request IDs even with a unique index',async()=>{
  const existing=await createStoredRevenuePreview(context('tenant1','legacy-nullable'));
  assert.equal(existing.ok,true);
  await pool.query('ALTER TABLE arge_report_previews ALTER COLUMN request_id DROP NOT NULL');
  try{
   await assert.rejects(pool.query(schema),/request_id must be NOT NULL/);
   const reports=(await pool.query('SELECT id,request_id FROM arge_report_previews')).rows;
   assert.deepEqual(reports.map(row=>[row.id,row.request_id]),[[existing.reportId,'legacy-nullable']]);
   assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM arge_audit_events')).rows[0].n,1);
  }finally{
   await pool.query('ALTER TABLE arge_report_previews ALTER COLUMN request_id SET NOT NULL');
  }
  await pool.query(schema);
 });

 test('native PostgreSQL rejects nullable legacy preview timestamps without deleting audit evidence',async()=>{
  const existing=await createStoredRevenuePreview(context('tenant1','legacy-null-time'));
  assert.equal(existing.ok,true);
  await pool.query('ALTER TABLE arge_report_previews ALTER COLUMN created_at DROP NOT NULL');
  try{
   // A legacy NULL timestamp is invisible to the daily quota count.
   await pool.query('UPDATE arge_report_previews SET created_at=NULL WHERE id=$1',[existing.reportId]);
   const daily=(await pool.query(`SELECT COUNT(*)::int AS n FROM arge_report_previews
    WHERE tenant_id=$1 AND created_at >=
     (date_trunc('day',NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')`,['tenant1'])).rows[0].n;
   assert.equal(daily,0);
   await assert.rejects(pool.query(schema),/created_at must be NOT NULL/);
   const rows=(await pool.query('SELECT id,created_at,audit_event_id FROM arge_report_previews')).rows;
   assert.deepEqual(rows.map(row=>[row.id,row.created_at,row.audit_event_id]),
    [[existing.reportId,null,existing.auditEventId]]);
   assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM arge_audit_events')).rows[0].n,1);
  }finally{
   // Repair only the isolated test fixture before the next test.
   await pool.query('UPDATE arge_report_previews SET created_at=NOW() WHERE created_at IS NULL');
   await pool.query('ALTER TABLE arge_report_previews ALTER COLUMN created_at SET NOT NULL');
  }
  await pool.query(schema);
 });

 test('native PostgreSQL rejects a fixed legacy preview timestamp default and preserves evidence',async()=>{
  // NOT NULL alone cannot enforce the daily quota when inserts omit created_at.
  await pool.query(`ALTER TABLE arge_report_previews
   ALTER COLUMN created_at SET DEFAULT '2000-01-01 00:00:00+00'::timestamptz`);
  try{
   const existing=await createStoredRevenuePreview(context('tenant1','legacy-fixed-default'));
   assert.equal(existing.ok,true);
   const row=(await pool.query('SELECT created_at,audit_event_id FROM arge_report_previews WHERE id=$1',
    [existing.reportId])).rows[0];
   assert.equal(row.created_at.toISOString(),'2000-01-01T00:00:00.000Z');
   assert.equal(row.audit_event_id,existing.auditEventId);
   const daily=(await pool.query(`SELECT COUNT(*)::int AS n FROM arge_report_previews
    WHERE tenant_id=$1 AND created_at >=
     (date_trunc('day',NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')`,['tenant1'])).rows[0].n;
   assert.equal(daily,0);
   await assert.rejects(pool.query(schema),/created_at must be timestamptz DEFAULT now\(\)/);
   const saved=(await pool.query('SELECT id,audit_event_id FROM arge_report_previews')).rows;
   assert.deepEqual(saved.map(r=>[r.id,r.audit_event_id]),
    [[existing.reportId,existing.auditEventId]]);
   assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM arge_audit_events')).rows[0].n,1);
  }finally{
   // Repair only the isolated fixture. No customer schema is modified.
   await pool.query('ALTER TABLE arge_report_previews ALTER COLUMN created_at SET DEFAULT NOW()');
  }
  await pool.query(schema);
 });

 test('native PostgreSQL grants scope all four launch service plans without execution or audit writes',async()=>{
  const now=Date.parse('2026-10-27T10:00:00.000Z');
  for(const service of LAUNCH_SERVICES.filter(item=>item.id!=='agent-audit-control')){
   await pool.query(`INSERT INTO arge_entitlements
    (tenant_id,service_id,status,expires_at,consent_verified)
    VALUES ($1,$2,'active','2099-01-01',$3)`,
    ['tenant1',service.id,service.sensitive]);
  }
  async function plan(service,tenant='tenant1'){
   // Read the grant from the isolated PostgreSQL service, never from a request.
   const row=(await pool.query(`SELECT status,revoked,expires_at AS "expiresAt",
    not_before AS "notBefore",consent_verified AS "consentVerified",
    consent_revoked AS "consentRevoked" FROM arge_entitlements
    WHERE tenant_id=$1 AND service_id=$2`,['tenant1',service.id])).rows[0];
   const entitlement={...row,source:'server',clientId:'tenant1',serviceId:service.id,
    expiresAt:row.expiresAt.toISOString(),
    notBefore:row.notBefore?.toISOString()};
   return prepareAuthorizedLaunchPlan({
    actor:{id:tenant,authenticated:true},
    membership:{actorId:tenant,tenantId:tenant,role:'owner',verified:true},
    sessionClientId:tenant,accountClientId:tenant,
    serviceId:service.id,capability:service.capabilities[0],entitlement,
    featureEnabled:true,globallyEnabled:true,now,
   });
  }
  assert.equal(LAUNCH_SERVICES.length,4);
  for(const service of LAUNCH_SERVICES){
   const authorized=await plan(service);
   assert.equal(authorized.ok,true,service.id);
   assert.equal(authorized.executes,false);
   assert.equal(authorized.auditPersisted,false);
   assert.equal(authorized.auditEvent.state,'prepared-not-persisted');
   assert.equal(authorized.auditEvent.tenantId,'tenant1');
   assert.equal(authorized.auditEvent.serviceId,service.id);
   const otherTenant=await plan(service,'tenant2');
   assert.equal(otherTenant.ok,false,service.id);
   assert.equal(otherTenant.reason,'service-entitlement-required');
   assert.equal('auditEvent' in otherTenant,false);
   if(service.sensitive){
    await pool.query(`UPDATE arge_entitlements SET consent_revoked=true
     WHERE tenant_id=$1 AND service_id=$2`,['tenant1',service.id]);
    const denied=await plan(service);
    assert.equal(denied.reason,'verified-consent-required',service.id);
    assert.equal('auditEvent' in denied,false);
   }
  }
  assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM arge_report_previews')).rows[0].n,0);
  assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM arge_audit_events')).rows[0].n,0);
 });


 test('native PostgreSQL tenant grants stay independent through revocation and expiry',async()=>{
  const service=LAUNCH_SERVICES.find(item=>item.id==='candidate-rediscovery');
  assert.ok(service?.sensitive);
  const now=Date.parse('2026-10-27T10:00:00.000Z');
  for(const tenant of ['tenant1','tenant2']){
   await pool.query(`INSERT INTO arge_entitlements
    (tenant_id,service_id,status,expires_at,consent_verified)
    VALUES ($1,$2,'active','2099-01-01',true)`,[tenant,service.id]);
  }
  async function plan(tenantId,grantTenantId=tenantId){
   const row=(await pool.query(`SELECT status,revoked,expires_at AS "expiresAt",
    not_before AS "notBefore",consent_verified AS "consentVerified",
    consent_revoked AS "consentRevoked" FROM arge_entitlements
    WHERE tenant_id=$1 AND service_id=$2`,[grantTenantId,service.id])).rows[0];
   // SQL NULL is not an entitlement timestamp; omit the optional field.
   const {notBefore,...persisted}=row;
   const entitlement={...persisted,source:'server',clientId:grantTenantId,serviceId:service.id,
    expiresAt:row.expiresAt.toISOString(),
    ...(notBefore==null?{}:{notBefore:notBefore.toISOString()})};
   return prepareAuthorizedLaunchPlan({
    actor:{id:tenantId,authenticated:true},
    membership:{actorId:tenantId,tenantId,role:'owner',verified:true},
    sessionClientId:tenantId,accountClientId:tenantId,
    serviceId:service.id,capability:service.capabilities[0],
    entitlement,featureEnabled:true,globallyEnabled:true,now,
   });
  }
  const firstTenant=await plan('tenant1');
  assert.equal(firstTenant.ok,true,JSON.stringify(firstTenant));
  const secondTenant=await plan('tenant2');
  assert.equal(secondTenant.ok,true,JSON.stringify(secondTenant));
  const stolenGrant=await plan('tenant2','tenant1');
  assert.equal(stolenGrant.ok,false);
  assert.equal(stolenGrant.reason,'service-entitlement-required');

  await pool.query(`UPDATE arge_entitlements SET consent_revoked=true
   WHERE tenant_id='tenant1' AND service_id=$1`,[service.id]);
  assert.equal((await plan('tenant1')).reason,'verified-consent-required');
  assert.equal((await plan('tenant2')).ok,true);

  await pool.query(`UPDATE arge_entitlements SET revoked=true
   WHERE tenant_id='tenant2' AND service_id=$1`,[service.id]);
  assert.equal((await plan('tenant2')).reason,'service-entitlement-required');

  await pool.query(`UPDATE arge_entitlements SET revoked=false,expires_at='2026-10-26'
   WHERE tenant_id='tenant2' AND service_id=$1`,[service.id]);
  assert.equal((await plan('tenant2')).reason,'entitlement-expired-or-unverifiable');

  await pool.query(`UPDATE arge_entitlements
   SET expires_at='2099-01-01',not_before='2026-10-28'
   WHERE tenant_id='tenant2' AND service_id=$1`,[service.id]);
  assert.equal((await plan('tenant2')).reason,'entitlement-not-yet-valid');
  assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM arge_report_previews')).rows[0].n,0);
  assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM arge_audit_events')).rows[0].n,0);
 });

 test('native PostgreSQL membership downgrade and disablement revoke launch planning',async()=>{
  const service=LAUNCH_SERVICES.find(item=>item.id==='agent-commerce-intelligence');
  assert.ok(service);
  const now=Date.parse('2026-10-27T10:00:00.000Z');
  await pool.query(`INSERT INTO arge_entitlements
   (tenant_id,service_id,status,expires_at)
   VALUES ('tenant1',$1,'active','2099-01-01')`,[service.id]);

  // Both membership and entitlement must be loaded from the isolated database.
  // A previously issued owner role or a client-supplied role is never trusted.
  async function plan(accountClientId='tenant1'){
   const membership=(await pool.query(`SELECT actor_id AS "actorId",
    tenant_id AS "tenantId",role,enabled AS verified
    FROM arge_memberships WHERE tenant_id='tenant1' AND actor_id='tenant1'`)).rows[0];
   const row=(await pool.query(`SELECT status,revoked,expires_at AS "expiresAt",
    not_before AS "notBefore",consent_verified AS "consentVerified",
    consent_revoked AS "consentRevoked" FROM arge_entitlements
    WHERE tenant_id='tenant1' AND service_id=$1`,[service.id])).rows[0];
   const {notBefore,...persisted}=row;
   const entitlement={...persisted,source:'server',clientId:'tenant1',
    serviceId:service.id,expiresAt:row.expiresAt.toISOString(),
    ...(notBefore==null?{}:{notBefore:notBefore.toISOString()})};
   return prepareAuthorizedLaunchPlan({
    actor:{id:'tenant1',authenticated:true},membership,
    sessionClientId:'tenant1',accountClientId,
    serviceId:service.id,capability:service.capabilities[0],
    entitlement,featureEnabled:true,globallyEnabled:true,now,
   });
  }

  assert.equal((await plan()).ok,true);
  await pool.query(`UPDATE arge_memberships SET role='manager'
   WHERE tenant_id='tenant1' AND actor_id='tenant1'`);
  assert.equal((await plan()).reason,'owner-required');
  await pool.query(`UPDATE arge_memberships SET role='viewer'
   WHERE tenant_id='tenant1' AND actor_id='tenant1'`);
  assert.equal((await plan()).reason,'insufficient-permission');
  await pool.query(`UPDATE arge_memberships SET role='owner',enabled=false
   WHERE tenant_id='tenant1' AND actor_id='tenant1'`);
  assert.equal((await plan()).reason,'unverified-membership');
  await pool.query(`UPDATE arge_memberships SET enabled=true
   WHERE tenant_id='tenant1' AND actor_id='tenant1'`);
  assert.equal((await plan('tenant2')).reason,'cross-tenant-denied');
  assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM arge_report_previews')).rows[0].n,0);
  assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM arge_audit_events')).rows[0].n,0);
 });

}
