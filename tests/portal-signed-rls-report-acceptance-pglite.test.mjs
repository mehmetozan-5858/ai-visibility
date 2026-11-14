import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createClientToken} from '../lib/admin-auth.js';
import {withVerifiedClientTenantRead} from '../lib/verified-tenant-transaction-review.mjs';
import {readCustomerComparisonReport} from '../lib/customer-comparison-report.mjs';

const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
test('portal report opt-in requires separate reader and never downgrades after error',async()=>{
 const src=await readFile(new URL('../app/api/client-portal/route.js',import.meta.url),'utf8');
 assert.match(src,/process\.env\.PORTAL_TENANT_RLS_ENABLED==='true'/);
 assert.match(src,/if\(!portalReadDatabaseEnabled\(\)\)/);
 assert.match(src,/inspectPortalReaderPrivileges\(reader\)/);
 assert.match(src,/if\(!privileges\.ready\)return privateJson\(/);
 assert.match(src,/withVerifiedClientTenantRead\(reader,store\.get\("ai_client"\)/);
 assert.match(src,/\(tx,tenantId\)=>readCustomerComparisonReport\(tx,tenantId\)/);
 assert.match(src,/catch\{return privateJson\(\{error:'Verified customer report could not be loaded\.'/);
 assert.match(src,/readCustomerComparisonReport\(databasePool\(getDatabaseUrl\(\)\),session\.clientId\)/);
 const strict=src.slice(src.indexOf("if(process.env.PORTAL_TENANT_RLS_ENABLED"),src.indexOf('}else{\n      try{',src.indexOf("if(process.env.PORTAL_TENANT_RLS_ENABLED")));
 assert.doesNotMatch(strict,/databasePool\(getDatabaseUrl\(\)\)/);
});

test('signed tenant transaction drives real comparison report SELECT with RLS',async()=>{
 const prior=process.env.AUTH_SECRET;
 process.env.AUTH_SECRET='synthetic-portal-proof-secret';
 const db=new PGlite();
 const pool={connect:async()=>({query:(...args)=>db.query(...args),release(){}})};
 try{
  await db.exec(`CREATE TABLE public.ai_provider_comparisons
   (client_id UUID,query TEXT,results JSONB,created_at TIMESTAMPTZ DEFAULT NOW());
   INSERT INTO public.ai_provider_comparisons(client_id,query,results) VALUES
    ('${A}','Synthetic tenant A','[]'::jsonb),
    ('${B}','Synthetic tenant B','[]'::jsonb);
   CREATE ROLE synthetic_report_reader LOGIN;
   GRANT USAGE ON SCHEMA public TO synthetic_report_reader;
   GRANT SELECT ON public.ai_provider_comparisons TO synthetic_report_reader;
   ALTER TABLE public.ai_provider_comparisons ENABLE ROW LEVEL SECURITY;
   ALTER TABLE public.ai_provider_comparisons FORCE ROW LEVEL SECURITY;
   CREATE POLICY report_session_scope ON public.ai_provider_comparisons
    FOR SELECT TO synthetic_report_reader
    USING (client_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid);
   SET ROLE synthetic_report_reader;`);
  const rows=await withVerifiedClientTenantRead(pool,await createClientToken(A),
    (tx,id)=>readCustomerComparisonReport(tx,id));
  assert.equal(rows.length,1);
  assert.equal(rows[0].clientId,A);
  assert.equal(rows[0].query,'Synthetic tenant A');
  const other=await withVerifiedClientTenantRead(pool,await createClientToken(B),
    (tx,id)=>readCustomerComparisonReport(tx,id));
  assert.equal(other.length,1);
  assert.equal(other[0].clientId,B);
  await assert.rejects(withVerifiedClientTenantRead(pool,'tampered',
    (tx,id)=>readCustomerComparisonReport(tx,id)),/tenant-session-invalid/);
  assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM public.ai_provider_comparisons')).rows[0].n,0);
  await db.exec('RESET ROLE');
 }finally{
  if(prior===undefined)delete process.env.AUTH_SECRET;else process.env.AUTH_SECRET=prior;
  await db.close();
 }
});
