/** Public GitHub evidence -> isolated temporary PostgreSQL -> report + audit.
 * Never connects to configured customer storage or deploys anything.
 */
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PGlite} from '@electric-sql/pglite';
import {createStoredReleasePreview} from '../lib/arge-report-repository.mjs';
const [targetSha,rollbackSha]=process.argv.slice(2);
if(!/^[a-f0-9]{40}$/.test(targetSha||'')||!/^[a-f0-9]{40}$/.test(rollbackSha||'')||targetSha===rollbackSha)
 throw Error('Two distinct explicit commit SHAs required');
const dir=await mkdtemp(join(tmpdir(),'release-source-acceptance-'));
let db;
try{
 db=new PGlite(dir);
 await db.exec(await readFile(new URL('../migrations/20261026_arge_report_previews.sql',import.meta.url),'utf8'));
 await db.exec(`INSERT INTO arge_memberships VALUES('isolated-acceptance','isolated-acceptance','owner',true);
  INSERT INTO arge_entitlements(tenant_id,service_id,status,expires_at)
  VALUES('isolated-acceptance','agent-audit-control','active','2099-01-01');`);
 const pool={connect:async()=>({query:(sql,args)=>db.query(sql,args),release(){}})};
 const context={pool,session:{clientId:'isolated-acceptance'},accountClientId:'isolated-acceptance',requestId:'public-github-acceptance',
  featureEnabled:true,globallyEnabled:true,targetSha,rollbackSha};
 const result=await createStoredReleasePreview(context);
 assert.equal(result.ok,true);assert.equal(result.auditPersisted,true);
 assert.equal(result.report.state,'checks-verified');assert.equal(result.report.deploymentAuthorized,false);
 assert.equal(result.customerDeliveryAuthorized,false);
 await db.close();db=new PGlite(dir);
 const replay=await createStoredReleasePreview({...context,fetchImpl:()=>{throw Error('Replay must not collect again')}});
 assert.equal(replay.replayed,true);assert.equal(replay.reportId,result.reportId);
 const count=(await db.query('SELECT COUNT(*)::int AS n FROM arge_audit_events')).rows[0].n;assert.equal(count,1);
 await db.exec('UPDATE arge_entitlements SET revoked=true');
 const revoked=await createStoredReleasePreview(context);assert.equal(revoked.ok,false);
 console.log(JSON.stringify({ok:true,scope:'live-public-github-to-isolated-postgres',subjectSha:targetSha,rollbackSha,
  checks:result.report.checks,provenance:result.report.provenance,auditCount:count,restartReplayVerified:true,
  revokedReplayDenied:true,productionStorageTouched:false,deploymentAuthorized:false}));
}finally{
 await db?.close();await rm(dir,{recursive:true,force:true});
}
