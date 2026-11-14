import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {inspectComparisonRlsPolicy,evaluateComparisonRlsPolicy} from '../lib/portal-report-rls-readiness.mjs';

test('opt-in portal refuses report when PostgreSQL RLS is disabled, unforced or has extra policies',async()=>{
 const db=new PGlite();
 try{
  assert.equal((await inspectComparisonRlsPolicy(db)).ready,false);
  await db.exec(`CREATE TABLE public.ai_provider_comparisons(client_id UUID,query TEXT);
    CREATE ROLE example_portal_reader LOGIN;`);
  assert.equal((await inspectComparisonRlsPolicy(db)).ready,false);
  await db.exec(`ALTER TABLE public.ai_provider_comparisons ENABLE ROW LEVEL SECURITY;
    CREATE POLICY portal_verified_tenant_comparison_select
    ON public.ai_provider_comparisons FOR SELECT TO PUBLIC
    USING (client_id=NULLIF(current_setting('app.tenant_id',true),'')::uuid)`);
  assert.equal((await inspectComparisonRlsPolicy(db)).ready,false,'FORCE RLS required');
  await db.exec('ALTER TABLE public.ai_provider_comparisons FORCE ROW LEVEL SECURITY');
  const good=await inspectComparisonRlsPolicy(db);
  assert.equal(good.ready,true,JSON.stringify(good));
  await db.exec(`CREATE POLICY overly_broad_select ON public.ai_provider_comparisons
    FOR SELECT TO PUBLIC USING(true)`);
  assert.equal((await inspectComparisonRlsPolicy(db)).ready,false,'extra permissive policy cannot pass');
  await db.exec('DROP POLICY overly_broad_select ON public.ai_provider_comparisons');
  await db.exec('ALTER TABLE public.ai_provider_comparisons DISABLE ROW LEVEL SECURITY');
  assert.equal((await inspectComparisonRlsPolicy(db)).ready,false);
 }finally{await db.close()}
});

test('RLS structural evaluator fails closed on missing and unscoped policy metadata',()=>{
 const good={table:{enabled:true,forced:true},policies:[{
  policyname:'portal_verified_tenant_comparison_select',permissive:'PERMISSIVE',
  roles:['public'],cmd:'SELECT',qual:"(client_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid)"
 }]};
 assert.equal(evaluateComparisonRlsPolicy(good).ready,true);
 for(const change of [
  {table:{enabled:true,forced:false}},
  {policies:[]},
  {policies:[{...good.policies[0],qual:'true'}]},
  {policies:[{...good.policies[0],qual:"client_id = current_setting('app.tenant_id')::uuid OR true"}]},
  {policies:[{...good.policies[0],policyname:'unexpected_policy'}]}
 ]) assert.equal(evaluateComparisonRlsPolicy({...good,...change}).ready,false);
});

test('customer report strict branch checks RLS after role preflight before reading tenant data',async()=>{
 const src=await readFile(new URL('../app/api/client-portal/route.js',import.meta.url),'utf8');
 const a=src.indexOf('inspectPortalReaderPrivileges(reader)');
 const b=src.indexOf('inspectComparisonRlsPolicy(reader)');
 const c=src.indexOf('withVerifiedClientTenantRead(reader');
 assert.ok(a>=0&&b>a&&c>b);
 assert.match(src,/if\(!rls\.ready\)return privateJson\(/);
});
