import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

// Exercise the operator migration against populated legacy tables, not only
// the empty-schema double-run covered by arge-report-postgres.test.mjs.
const schema = await readFile(new URL('../migrations/20261026_arge_report_previews.sql',import.meta.url),'utf8');
const indexDDL = /CREATE UNIQUE INDEX IF NOT EXISTS arge_report_previews_tenant_audit_unique\s+ON arge_report_previews\(tenant_id,audit_event_id\);/;
assert.match(schema,indexDDL);
const indexGuard = /-- BEGIN ARGE AUDIT INDEX GUARD[\s\S]*?-- END ARGE AUDIT INDEX GUARD\s*/;
assert.match(schema,indexGuard);
const legacySchema = schema.replace(indexDDL,'').replace(indexGuard,'');
assert.notEqual(legacySchema,schema);

async function insertAudit(db){
 await db.query(`INSERT INTO arge_audit_events
  (id,tenant_id,actor_id,service_id,event_type,occurred_at,payload)
  VALUES('audit1','tenant1','actor1','agent-audit-control','report-prepared',NOW(),'{}'::jsonb)`);
}
async function insertReport(db,id,requestId){
 return db.query(`INSERT INTO arge_report_previews
  (id,tenant_id,request_id,kind,report,audit_event_id)
  VALUES($1,'tenant1',$2,'revenue-integrity','{}'::jsonb,'audit1')`,[id,requestId]);
}
async function indexCount(db){
 const result=await db.query(`SELECT COUNT(*)::int AS n FROM pg_indexes
  WHERE schemaname=current_schema() AND tablename='arge_report_previews'
   AND indexname='arge_report_previews_tenant_audit_unique'`);
 return result.rows[0].n;
}

test('operator migration upgrades populated legacy tables and preserves audit evidence',async()=>{
 const db=new PGlite();
 try{
  await db.exec(legacySchema);
  await insertAudit(db);
  await insertReport(db,'report1','request1');
  assert.equal(await indexCount(db),0);
  await db.exec(schema);
  await db.exec(schema); // upgrade must also remain idempotent
  assert.equal(await indexCount(db),1);
  await assert.rejects(insertReport(db,'report2','request2'));
  const reports=(await db.query('SELECT id,audit_event_id FROM arge_report_previews')).rows;
  assert.deepEqual(reports.map(r=>[r.id,r.audit_event_id]),[['report1','audit1']]);
  assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM arge_audit_events')).rows[0].n,1);
 }finally{await db.close();}
});

test('operator migration fails closed on pre-existing duplicate audit references without deleting rows',async()=>{
 const db=new PGlite();
 try{
  await db.exec(legacySchema);
  await insertAudit(db);
  await insertReport(db,'report1','request1');
  await insertReport(db,'report2','request2');
  await assert.rejects(db.exec(schema));
  // A failed explicit transaction may still require a rollback before reads.
  await db.exec('ROLLBACK');
  assert.equal(await indexCount(db),0);
  const rows=(await db.query('SELECT id FROM arge_report_previews ORDER BY id')).rows;
  assert.deepEqual(rows.map(r=>r.id),['report1','report2']);
  assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM arge_audit_events')).rows[0].n,1);
 }finally{await db.close();}
});

test('operator migration rejects a same-named non-unique index without changing legacy rows',async()=>{
 const db=new PGlite();
 try{
  await db.exec(legacySchema);
  await insertAudit(db);
  await insertReport(db,'report1','request1');
  await db.exec('CREATE INDEX arge_report_previews_tenant_audit_unique ON arge_report_previews(tenant_id,audit_event_id)');
  await assert.rejects(db.exec(schema),/arge_report_previews_tenant_audit_unique is missing or invalid/);
  await db.exec('ROLLBACK');
  const metadata=(await db.query(`SELECT i.indisunique AS unique_index FROM pg_index i
   JOIN pg_class c ON c.oid=i.indexrelid WHERE c.relname='arge_report_previews_tenant_audit_unique'`)).rows;
  assert.equal(metadata.length,1);
  assert.equal(metadata[0].unique_index,false);
  assert.deepEqual((await db.query('SELECT id FROM arge_report_previews')).rows.map(r=>r.id),['report1']);
 }finally{await db.close();}
});

test('operator migration rejects a same-named unique index over the wrong columns',async()=>{
 const db=new PGlite();
 try{
  await db.exec(legacySchema);
  await insertAudit(db);
  await insertReport(db,'report1','request1');
  await db.exec('CREATE UNIQUE INDEX arge_report_previews_tenant_audit_unique ON arge_report_previews(tenant_id,request_id)');
  await assert.rejects(db.exec(schema),/arge_report_previews_tenant_audit_unique is missing or invalid/);
  await db.exec('ROLLBACK');
  assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM arge_report_previews')).rows[0].n,1);
 }finally{await db.close();}
});

async function removeTenantAuditForeignKey(db){
 const constraints=(await db.query(`SELECT conname FROM pg_constraint
  WHERE conrelid='arge_report_previews'::regclass AND contype='f'`)).rows;
 assert.equal(constraints.length,1);
 const name=constraints[0].conname.replaceAll('"','""');
 await db.exec(`ALTER TABLE arge_report_previews DROP CONSTRAINT "${name}"`);
}

test('operator migration rejects an existing report table missing its tenant-scoped audit FK',async()=>{
 const db=new PGlite();
 try{
  await db.exec(legacySchema);
  await insertAudit(db);
  await insertReport(db,'report1','request1');
  await removeTenantAuditForeignKey(db);
  await assert.rejects(db.exec(schema),/tenant audit foreign key is missing or invalid/);
  await db.exec('ROLLBACK');
  assert.deepEqual((await db.query('SELECT id FROM arge_report_previews')).rows.map(r=>r.id),['report1']);
  assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM arge_audit_events')).rows[0].n,1);
 }finally{await db.close();}
});

test('operator migration rejects a weakened audit-only FK even if existing data is valid',async()=>{
 const db=new PGlite();
 try{
  await db.exec(legacySchema);
  await insertAudit(db);
  await insertReport(db,'report1','request1');
  await removeTenantAuditForeignKey(db);
  await db.exec(`ALTER TABLE arge_report_previews ADD CONSTRAINT arge_audit_only_fk
   FOREIGN KEY(audit_event_id) REFERENCES arge_audit_events(id)
   DEFERRABLE INITIALLY DEFERRED`);
  await assert.rejects(db.exec(schema),/tenant audit foreign key is missing or invalid/);
  await db.exec('ROLLBACK');
  assert.deepEqual((await db.query('SELECT id FROM arge_report_previews')).rows.map(r=>r.id),['report1']);
 }finally{await db.close();}
});
