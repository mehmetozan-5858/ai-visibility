import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {createAuditPreviewHandler} from '../lib/audit-preview-handler.mjs';
import {createClientToken,verifyClientToken} from '../lib/admin-auth.js';

test('shared production handler: signed HTTP request, PostgreSQL audit, restart, tenant and revocation boundaries',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'audit-http-pg-'));
 const previous=process.env.AUTH_SECRET;process.env.AUTH_SECRET=randomBytes(32).toString('hex');
 let db=new PGlite(dir),server;
 try{
  await db.exec(await readFile(new URL('../migrations/20261026_arge_report_previews.sql',import.meta.url),'utf8'));
  await db.exec(`INSERT INTO arge_memberships VALUES ('tenant1','tenant1','owner',true),('tenant2','tenant2','owner',true);
   INSERT INTO arge_entitlements(tenant_id,service_id,status,expires_at) VALUES ('tenant1','agent-audit-control','active','2099-01-01');
   INSERT INTO arge_revenue_ledger VALUES ('tenant1','expected','e1','sub1','s1','2026-10','EUR','100'),
    ('tenant1','invoiced','i1','sub1','s2','2026-10','EUR','90'),
    ('tenant2','expected','e2','sub2','s3','2026-10','EUR','999999');`);
  const pool={connect:async()=>({query:(q,p)=>db.query(q,p),release(){}})};
  const handler=createAuditPreviewHandler({
   getSession:req=>verifyClientToken((req.headers.get('cookie')||'').replace(/^ai_client=/,'')),
   getSettings:()=>({ARGE_REPORT_PREVIEW_ENABLED:'true',ARGE_AUDIT_SERVICE_ENABLED:'true'}),
   getClientAccount:async id=>({client:{id}}),customerAccess:async()=>({allowed:true,kind:'pilot'}),
   getDatabaseUrl:()=> 'isolated-fixture',databasePool:()=>pool,
  });
  server=createServer(async(req,res)=>{
   const chunks=[];for await(const chunk of req)chunks.push(chunk);
   const response=await handler(new Request('http://'+req.headers.host+req.url,{method:req.method,headers:req.headers,body:Buffer.concat(chunks)}));
   res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const origin='http://127.0.0.1:'+server.address().port;
  const one=await createClientToken('tenant1'),two=await createClientToken('tenant2');
  const call=(token,body={requestId:'r1'})=>fetch(origin+'/api/client-audit-preview',{method:'POST',headers:{origin,'content-type':'application/json',cookie:'ai_client='+token},body:JSON.stringify(body)});
  assert.equal((await call(one+'bad')).status,401);
  assert.equal((await call(one,{requestId:'r1',tenantId:'tenant2'})).status,400);
  let response=await call(one);assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);
  const first=await response.json();assert.equal(first.auditPersisted,true);assert.equal(first.customerDeliveryAuthorized,false);
  assert.equal(first.report.comparisons.length,1);assert.equal(first.report.comparisons[0].differenceMinor,'10');
  assert.equal((await call(two)).status,403);
  await db.close();db=new PGlite(dir);
  response=await call(one);const replay=await response.json();assert.equal(response.status,200);
  assert.equal(replay.reportId,first.reportId);assert.equal(replay.replayed,true);
  assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM arge_audit_events')).rows[0].n,1);
  await db.query("UPDATE arge_entitlements SET revoked=true WHERE tenant_id='tenant1'");
  response=await call(one);assert.equal(response.status,403);assert.equal('report' in await response.json(),false);
 }finally{
  if(server){await new Promise(resolve=>server.close(resolve));}
  await db.close();await rm(dir,{recursive:true,force:true});
  if(previous===undefined)delete process.env.AUTH_SECRET;else process.env.AUTH_SECRET=previous;
 }
});
