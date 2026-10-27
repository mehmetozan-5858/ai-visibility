import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readZeraDiagnostics,diagnosticSettings,createZeraDiagnosticsHandler} from '../lib/zera-readonly-diagnostics.mjs';
let db,dir,pool;const client='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
before(async()=>{
 dir=await mkdtemp(join(tmpdir(),'zera-readonly-'));db=new PGlite(dir);
 await db.exec(`CREATE TABLE clients(id UUID PRIMARY KEY,name TEXT,plan TEXT);
 CREATE TABLE ai_provider_comparisons(id UUID,client_id UUID,query TEXT,results JSONB,created_at TIMESTAMPTZ DEFAULT NOW());
 CREATE TABLE zera_ai_task_attempts(client_id UUID,task_id TEXT,status TEXT);
 INSERT INTO clients VALUES('${client}','ZERA Clothing','Pilot'),('${other}','Other fixture','Pilot');
 INSERT INTO ai_provider_comparisons VALUES('${other}','${other}','private fixture','[]',NOW());
 INSERT INTO zera_ai_task_attempts VALUES('${client}','brand-ai-de','provider-failed'),('${other}','brand-ai-tr','stored');`);
 pool={connect:async()=>({query:(sql,args)=>db.query(sql,args),release(){}})};
});
after(async()=>{await db.close();await rm(dir,{recursive:true,force:true})});
test('read-only SQL inspection handles historical missing reasons and excludes another customer',async()=>{
 const result=await readZeraDiagnostics({pool,env:{GEMINI_API_KEY:'PRIVATEKEY',ZERA_GEMINI_FREE_TIER_CONFIRMED:'true'}});
 assert.equal(result.pilot.identified,true);assert.equal(result.storage.comparisonCount,0);
 assert.equal(result.tasks[0].status,'provider-failed');assert.equal(result.tasks[0].failureReason,null);
 assert.equal(result.tasks[1].status,'not-observed');assert.equal(result.storage.failureReasonColumnAvailable,false);
 assert.equal(result.providerRequests,0);assert.equal(result.readOnly,true);assert.equal(result.storage.insertActuallyTested,false);
 assert.equal(result.settings.providerAccessVerified,false);assert.equal(result.settings.providerQuotaVerified,false);
 assert.doesNotMatch(JSON.stringify(result),/PRIVATEKEY|private fixture|Other fixture|11111111|22222222/);
 // A write attempted on the same diagnostic transaction is rejected by PostgreSQL.
 const forbidden={connect:async()=>({query:async(sql,args)=>{
  if(sql.startsWith('SELECT table_name'))return db.query("DELETE FROM clients");return db.query(sql,args);
 },release(){}})};
 await assert.rejects(readZeraDiagnostics({pool:forbidden}));
 assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM clients')).rows[0].n,2);
});
test('optional failure reasons are strictly allowlisted and never reflect arbitrary payloads',async()=>{
 await db.exec("ALTER TABLE zera_ai_task_attempts ADD COLUMN failure_reason TEXT;UPDATE zera_ai_task_attempts SET failure_reason='private SQL token'");
 let r=await readZeraDiagnostics({pool});assert.equal(r.tasks[0].failureReason,null);
 await db.query("UPDATE zera_ai_task_attempts SET failure_reason='provider-model-not-found' WHERE client_id=$1",[client]);
 r=await readZeraDiagnostics({pool});assert.equal(r.tasks[0].failureReason,'provider-model-not-found');
 assert.equal(r.historicalFailureCauseKnown,false);
});
test('duplicate pilot identity fails closed instead of reading either customer history',async()=>{
 await db.query("UPDATE clients SET name='ZERA Clothing' WHERE id=$1",[other]);
 try{const r=await readZeraDiagnostics({pool});assert.equal(r.pilot.identified,false);assert.equal(r.pilot.identityAmbiguous,true);assert.equal(r.storage.comparisonCount,null);}
 finally{await db.query("UPDATE clients SET name='Other fixture' WHERE id=$1",[other])}
});
test('missing comparison table is reported without provisioning or claiming an attempt',async()=>{
 await db.exec('ALTER TABLE ai_provider_comparisons RENAME TO hidden_comparisons');
 try{const r=await readZeraDiagnostics({pool});assert.equal(r.storage.comparisonTablePresent,false);assert.equal(r.storage.insertPrivilege,null);}
 finally{await db.exec('ALTER TABLE hidden_comparisons RENAME TO ai_provider_comparisons')}
});
test('handler rejects unauthenticated users, selectors and writes before storage access',async()=>{
 let allowed=false,connects=0;
 const handler=createZeraDiagnosticsHandler({authorize:async()=>allowed?null:Response.json({error:'unauthorized'},{status:401}),getPool:()=>{connects++;return pool},getSettings:()=>({})});
 const req=(suffix='',method='GET')=>new Request('https://app.example/api/clients/zera-diagnostics'+suffix,{method});
 assert.equal((await handler(req())).status,401);allowed=true;
 assert.equal((await handler(req('?clientId=other'))).status,400);assert.equal((await handler(req('','POST'))).status,405);
 assert.equal(connects,0);const r=await handler(req());assert.equal(r.status,200);assert.match(r.headers.get('cache-control'),/no-store/);
});
test('storage failures and invalid settings do not expose raw keys, error text or inherited codes',async()=>{
 const handler=createZeraDiagnosticsHandler({authorize:async()=>null,getSettings:()=>({}),getPool:()=>({connect:async()=>{throw Object.assign(Error('PRIVATE connection string'),{code:'toString'})}})});
 const r=await handler(new Request('https://app.example/api/clients/zera-diagnostics'));assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/PRIVATE|connection string|toString/);
 const config=diagnosticSettings({ZERA_GEMINI_MODEL:'secret/invalid?key=PRIVATE',GEMINI_API_KEY:'PRIVATE'});
 assert.equal(config.model,null);assert.equal(config.modelConfigurationValid,false);assert.doesNotMatch(JSON.stringify(config),/PRIVATE/);
});
