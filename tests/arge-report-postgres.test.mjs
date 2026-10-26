import test,{before,beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PGlite} from '@electric-sql/pglite';
import {createStoredRevenuePreview} from '../lib/arge-report-repository.mjs';
let db,pool,dataDir;
const context={session:{clientId:'tenant1'},accountClientId:'tenant1',requestId:'request1',featureEnabled:true,globallyEnabled:true};
before(async()=>{
 dataDir=await mkdtemp(join(tmpdir(),'arge-postgres-'));
 db=new PGlite(dataDir);pool={connect:async()=>({query:(q,p)=>db.query(q,p),release(){}})};
 const schema=await readFile(new URL('../migrations/20261026_arge_report_previews.sql',import.meta.url),'utf8');
 await db.exec(schema);await db.exec(schema);
});
beforeEach(async()=>{
 await db.exec(`TRUNCATE arge_report_previews,arge_audit_events,arge_revenue_ledger,arge_entitlements,arge_memberships;
  ALTER TABLE arge_audit_events DROP CONSTRAINT IF EXISTS reject_audit;
  INSERT INTO arge_memberships VALUES('tenant1','tenant1','owner',true),('tenant2','tenant2','owner',true);
  INSERT INTO arge_entitlements(tenant_id,service_id,status,expires_at) VALUES('tenant1','agent-audit-control','active','2099-01-01');
  INSERT INTO arge_revenue_ledger VALUES
   ('tenant1','expected','e1','sub1','source1','2026-10','EUR','100'),
   ('tenant1','invoiced','i1','sub1','source2','2026-10','EUR','90'),
   ('tenant2','expected','e2','sub2','source3','2026-10','EUR','999999');`);
});
after(async()=>{await db?.close();if(dataDir)await rm(dataDir,{recursive:true,force:true});});
test('real PostgreSQL transaction loads only the authenticated tenant and persists report plus audit',async()=>{
 const result=await createStoredRevenuePreview({pool,...context});
 assert.equal(result.ok,true);assert.equal(result.auditPersisted,true);
 assert.equal(result.report.comparisons.length,1);assert.equal(result.report.comparisons[0].differenceMinor,'10');
 const rows=(await db.query('SELECT r.tenant_id,a.tenant_id AS audit_tenant,a.payload FROM arge_report_previews r JOIN arge_audit_events a ON r.audit_event_id=a.id')).rows;
 assert.equal(rows.length,1);assert.equal(rows[0].tenant_id,'tenant1');assert.equal(rows[0].audit_tenant,'tenant1');
 assert.equal(rows[0].payload.state,'persisted');assert.equal(result.customerDeliveryAuthorized,false);
});
test('same request returns the original report and exactly one audit',async()=>{
 const first=await createStoredRevenuePreview({pool,...context});
 await db.query("UPDATE arge_revenue_ledger SET amount_minor='200' WHERE tenant_id='tenant1' AND record_kind='expected'");
 const second=await createStoredRevenuePreview({pool,...context});
 assert.equal(second.replayed,true);assert.equal(second.reportId,first.reportId);assert.deepEqual(second.report,first.report);
 assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM arge_audit_events')).rows[0].n,1);
});
test('committed report and audit survive closing and reopening PostgreSQL storage',async()=>{
 const first=await createStoredRevenuePreview({pool,...context});
 await db.close();db=new PGlite(dataDir);
 const replay=await createStoredRevenuePreview({pool,...context});
 assert.equal(replay.ok,true);assert.equal(replay.replayed,true);assert.equal(replay.reportId,first.reportId);
 assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM arge_audit_events')).rows[0].n,1);
});
test('audit insert failure rolls the report back in real PostgreSQL',async()=>{
 await db.exec('ALTER TABLE arge_audit_events ADD CONSTRAINT reject_audit CHECK (false) NOT VALID');
 await assert.rejects(createStoredRevenuePreview({pool,...context}));
 assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM arge_report_previews')).rows[0].n,0);
 assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM arge_audit_events')).rows[0].n,0);
});
test('revocation prevents replay of an already stored report',async()=>{
 await createStoredRevenuePreview({pool,...context});
 await db.query("UPDATE arge_entitlements SET revoked=true WHERE tenant_id='tenant1'");
 const result=await createStoredRevenuePreview({pool,...context});
 assert.equal(result.ok,false);assert.equal('report' in result,false);
});
test('expired grants and disabled membership deny before report persistence',async()=>{
 await db.query("UPDATE arge_entitlements SET expires_at='2000-01-01' WHERE tenant_id='tenant1'");
 assert.equal((await createStoredRevenuePreview({pool,...context})).ok,false);
 await db.query("UPDATE arge_entitlements SET expires_at='2099-01-01' WHERE tenant_id='tenant1'");
 await db.query("UPDATE arge_memberships SET enabled=false WHERE tenant_id='tenant1'");
 assert.equal((await createStoredRevenuePreview({pool,...context})).ok,false);
 assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM arge_report_previews')).rows[0].n,0);
});
test('session mismatch and non-boolean feature flags never connect to storage',async()=>{
 const forbiddenPool={connect(){throw Error('must-not-connect');}};
 for(const change of [{accountClientId:'tenant2'},{featureEnabled:'true'},{globallyEnabled:false},{requestId:'../bad'}])
  assert.equal((await createStoredRevenuePreview({pool:forbiddenPool,...context,...change})).ok,false);
});
test('daily storage budget caps new reports while authorized replays remain available',async()=>{
 for(let i=0;i<30;i++)assert.equal((await createStoredRevenuePreview({pool,...context,requestId:'request'+i})).ok,true);
 const denied=await createStoredRevenuePreview({pool,...context,requestId:'request31'});
 assert.equal(denied.ok,false);assert.equal(denied.reason,'preview-daily-limit');
 assert.equal((await createStoredRevenuePreview({pool,...context,requestId:'request0'})).replayed,true);
 assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM arge_audit_events')).rows[0].n,30);
});

test('identical request IDs remain isolated across two authorized tenants and their audit records',async()=>{
 await db.query("INSERT INTO arge_entitlements(tenant_id,service_id,status,expires_at) VALUES('tenant2','agent-audit-control','active','2099-01-01')");
 const tenant2={...context,session:{clientId:'tenant2'},accountClientId:'tenant2'};
 const one=await createStoredRevenuePreview({pool,...context});
 const two=await createStoredRevenuePreview({pool,...tenant2});
 assert.equal(one.ok,true);assert.equal(two.ok,true);
 assert.notEqual(one.reportId,two.reportId);
 assert.notEqual(one.auditEventId,two.auditEventId);
 assert.equal(one.report.tenantId,'tenant1');assert.equal(two.report.tenantId,'tenant2');
 assert.equal(one.report.comparisons[0].subscriptionId,'sub1');
 assert.equal(two.report.comparisons[0].subscriptionId,'sub2');
 assert.equal(two.report.comparisons[0].status,'missing-invoice');
 const rows=(await db.query('SELECT tenant_id,request_id,audit_event_id FROM arge_report_previews ORDER BY tenant_id')).rows;
 assert.deepEqual(rows.map(row=>[row.tenant_id,row.request_id]),[['tenant1','request1'],['tenant2','request1']]);
 assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM arge_audit_events')).rows[0].n,2);
 const replayOne=await createStoredRevenuePreview({pool,...context});
 const replayTwo=await createStoredRevenuePreview({pool,...tenant2});
 assert.equal(replayOne.replayed,true);assert.equal(replayTwo.replayed,true);
 assert.equal(replayOne.reportId,one.reportId);assert.equal(replayTwo.reportId,two.reportId);
 assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM arge_audit_events')).rows[0].n,2);
});

test('stored preview replay is denied after owner role downgrade, then resumes only after restoration',async()=>{
 const first=await createStoredRevenuePreview({pool,...context});
 assert.equal(first.ok,true);
 await db.query("UPDATE arge_memberships SET role='viewer' WHERE tenant_id='tenant1' AND actor_id='tenant1'");
 const denied=await createStoredRevenuePreview({pool,...context});
 assert.equal(denied.ok,false);
 assert.equal(denied.reason,'insufficient-permission');
 assert.equal('report' in denied,false);
 assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM arge_audit_events')).rows[0].n,1);
 await db.query("UPDATE arge_memberships SET role='owner' WHERE tenant_id='tenant1' AND actor_id='tenant1'");
 const replay=await createStoredRevenuePreview({pool,...context});
 assert.equal(replay.ok,true);
 assert.equal(replay.replayed,true);
 assert.equal(replay.reportId,first.reportId);
 assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM arge_audit_events')).rows[0].n,1);
});
