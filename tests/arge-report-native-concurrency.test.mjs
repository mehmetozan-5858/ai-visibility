import test,{before,beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import pg from 'pg';
import {createStoredRevenuePreview} from '../lib/arge-report-repository.mjs';

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
    url.password || url.search || url.hash || url.protocol!=='postgres:'){
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
}
