import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';

// Isolated review-only RLS acceptance. No production ALTER TABLE or GRANT.
// NOTE: custom session settings are forgeable by a compromised SQL client.
// A production tenant context needs a trusted server boundary and least-privilege
// connection plus a separately reviewed session-binding design.
const tenantA='11111111-1111-4111-8111-111111111111';
const tenantB='22222222-2222-4222-8222-222222222222';
const q=(db,sql,args)=>db.query(sql,args);

test('RLS rejects cross-tenant rows and default/no-tenant reads under portal role',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`
   CREATE TABLE public.clients(id UUID PRIMARY KEY,name TEXT NOT NULL);
   CREATE TABLE public.ai_provider_comparisons(
    id UUID PRIMARY KEY,client_id UUID NOT NULL REFERENCES public.clients(id),
    query TEXT NOT NULL,created_at TIMESTAMPTZ DEFAULT NOW());
   INSERT INTO public.clients(id,name) VALUES
    ('${tenantA}','Synthetic A'),('${tenantB}','Synthetic B');
   INSERT INTO public.ai_provider_comparisons(id,client_id,query) VALUES
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','${tenantA}','Synthetic A report'),
    ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','${tenantB}','Synthetic B report');
   CREATE ROLE synthetic_rls_portal LOGIN;
   GRANT USAGE ON SCHEMA public TO synthetic_rls_portal;
   GRANT SELECT ON public.clients,public.ai_provider_comparisons TO synthetic_rls_portal;
   ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
   ALTER TABLE public.clients FORCE ROW LEVEL SECURITY;
   ALTER TABLE public.ai_provider_comparisons ENABLE ROW LEVEL SECURITY;
   ALTER TABLE public.ai_provider_comparisons FORCE ROW LEVEL SECURITY;
   CREATE POLICY client_tenant_select ON public.clients FOR SELECT TO synthetic_rls_portal
    USING (id = NULLIF(current_setting('app.tenant_id',true),'')::uuid);
   CREATE POLICY comparison_tenant_select ON public.ai_provider_comparisons
    FOR SELECT TO synthetic_rls_portal
    USING (client_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid);
  `);
  await db.exec('SET ROLE synthetic_rls_portal');
  const sql='SELECT client_id,query FROM public.ai_provider_comparisons ORDER BY query';
  assert.equal((await q(db,sql)).rows.length,0,'without verified tenant context no rows');
  await db.exec('BEGIN');
  await q(db,"SELECT set_config('app.tenant_id',$1,true)",[tenantA]);
  const a=(await q(db,sql)).rows;
  assert.deepEqual(a.map(x=>x.query),['Synthetic A report']);
  assert.equal((await q(db,'SELECT name FROM public.clients')).rows[0].name,'Synthetic A');
  assert.equal((await q(db,'SELECT count(*)::int AS n FROM public.ai_provider_comparisons WHERE client_id=$1',[tenantB])).rows[0].n,0);
  await assert.rejects(q(db,"UPDATE public.ai_provider_comparisons SET query='modified'"),/permission denied/i);
  await db.exec('COMMIT');
  assert.equal((await q(db,sql)).rows.length,0,'tenant context cannot leak outside transaction');
  await db.exec('BEGIN');
  await q(db,"SELECT set_config('app.tenant_id',$1,true)",[tenantB]);
  assert.deepEqual((await q(db,sql)).rows.map(x=>x.query),['Synthetic B report']);
  await db.exec('ROLLBACK');
  assert.equal((await q(db,sql)).rows.length,0);
  await db.exec('RESET ROLE');
 }finally{await db.close()}
});

test('RLS acceptance is not equivalent to verified client session binding',async()=>{
 const evidence=await import('../lib/portal-role-readiness.mjs');
 assert.ok(evidence.portalReaderRequiredTables.includes('ai_provider_comparisons'));
 // A SQL client can set arbitrary custom parameters. This synthetic test
 // only certifies row-filtering under a supplied context; live authorization
 // must prove the app derives that context exclusively from signed sessions.
});
