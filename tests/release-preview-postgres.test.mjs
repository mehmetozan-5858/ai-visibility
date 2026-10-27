import test,{before,beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PGlite} from '@electric-sql/pglite';
import {createStoredReleasePreview,createStoredRevenuePreview} from '../lib/arge-report-repository.mjs';
import {createAuditPreviewHandler} from '../lib/audit-preview-handler.mjs';
const targetSha='a'.repeat(40),rollbackSha='b'.repeat(40);
let db,dir,pool,calls,failed;
const context={session:{clientId:'tenant1'},accountClientId:'tenant1',requestId:'release1',featureEnabled:true,globallyEnabled:true,targetSha,rollbackSha};
const source=async(url,options)=>{
 calls++;assert.equal(options.method,'GET');assert.equal(options.redirect,'error');
 assert.match(url,/^https:\/\/api.github.com\/repos\/mehmetozan-5858\/ai-visibility\//);
 if(failed)return new Response('private remote detail',{status:503});
 return Response.json(url.includes('check-runs')?{total_count:2,check_runs:['build','web-mobile-smoke'].map((name,i)=>({name,id:i+1,head_sha:targetSha,status:'completed',conclusion:'success',app:{id:15368,slug:'github-actions'}}))}:{sha:rollbackSha});
};
before(async()=>{
 dir=await mkdtemp(join(tmpdir(),'release-preview-'));db=new PGlite(dir);
 pool={connect:async()=>({query:(sql,args)=>db.query(sql,args),release(){}})};
 await db.exec(await readFile(new URL('../migrations/20261026_arge_report_previews.sql',import.meta.url),'utf8'));
});
beforeEach(async()=>{
 calls=0;failed=false;
 await db.exec(`TRUNCATE arge_report_previews,arge_audit_events,arge_memberships,arge_entitlements;
 ALTER TABLE arge_audit_events DROP CONSTRAINT IF EXISTS reject_release_audit;
 INSERT INTO arge_memberships VALUES('tenant1','tenant1','owner',true),('tenant2','tenant2','owner',true);
 INSERT INTO arge_entitlements(tenant_id,service_id,status,expires_at) VALUES('tenant1','agent-audit-control','active','2099-01-01');`);
});
after(async()=>{await db.close();await rm(dir,{recursive:true,force:true})});
const run=extra=>createStoredReleasePreview({pool,...context,fetchImpl:source,...extra});
test('server GitHub evidence and audit persist atomically; restart replay makes no new request',async()=>{
 const first=await run();assert.equal(first.ok,true);assert.equal(calls,2);
 assert.equal(first.report.state,'checks-verified');assert.equal(first.report.deploymentAuthorized,false);
 assert.equal(first.customerDeliveryAuthorized,false);assert.match(first.report.provenance.sourceUrl,/check-runs/);
 await db.close();db=new PGlite(dir);
 const replay=await run();assert.equal(replay.reportId,first.reportId);assert.equal(replay.replayed,true);assert.equal(calls,2);
 assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM arge_audit_events')).rows[0].n,1);
});
test('tenant mismatch, missing grant and revoked replay deny before GitHub collection',async()=>{
 assert.equal((await run({accountClientId:'tenant2'})).ok,false);
 assert.equal((await run({session:{clientId:'tenant2'},accountClientId:'tenant2'})).ok,false);
 assert.equal(calls,0);
 await run();await db.exec("UPDATE arge_entitlements SET revoked=true");
 assert.equal((await run()).ok,false);assert.equal(calls,2);
});
test('GitHub failure or audit failure leaves neither report nor audit',async()=>{
 failed=true;await assert.rejects(run(),/github-source-http-503/);
 failed=false;await db.exec('ALTER TABLE arge_audit_events ADD CONSTRAINT reject_release_audit CHECK(false) NOT VALID');
 await assert.rejects(run());
 assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM arge_report_previews')).rows[0].n,0);
 assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM arge_audit_events')).rows[0].n,0);
});
test('request IDs cannot replay a different report kind',async()=>{
 await createStoredRevenuePreview({pool,...context});
 const result=await run();assert.equal(result.ok,false);assert.equal(result.reason,'request-kind-conflict');assert.equal(calls,0);
});
test('release HTTP boundary requires its extra flag and rejects client evidence/commit selection',async()=>{
 let enabled=false;
 const handler=createAuditPreviewHandler({reportKind:'release-assurance',fetchGithub:source,
  getSession:async()=>context.session,getSettings:()=>({ARGE_REPORT_PREVIEW_ENABLED:'true',ARGE_AUDIT_SERVICE_ENABLED:'true',ARGE_RELEASE_PREVIEW_ENABLED:String(enabled),ARGE_RELEASE_TARGET_SHA:targetSha,ARGE_RELEASE_ROLLBACK_SHA:rollbackSha}),
  getClientAccount:async id=>({client:{id}}),customerAccess:async()=>({allowed:true,kind:'pilot'}),getDatabaseUrl:()=> 'isolated',databasePool:()=>pool});
 const request=body=>new Request('https://app.example/api/client-release-preview',{method:'POST',headers:{host:'app.example',origin:'https://app.example','content-type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await handler(request({requestId:'http1'}))).status,403);assert.equal(calls,0);
 enabled=true;
 assert.equal((await handler(request({requestId:'http1',targetSha,checks:[]}))).status,400);assert.equal(calls,0);
 const response=await handler(request({requestId:'http1'}));assert.equal(response.status,200);
 assert.match(response.headers.get('cache-control'),/no-store/);assert.equal((await response.json()).report.targetSha,targetSha);
});
