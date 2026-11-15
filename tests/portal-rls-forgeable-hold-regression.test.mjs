import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {evaluateComparisonRlsPolicy} from '../lib/portal-report-rls-readiness.mjs';

// A structural tenant setting is forgeable by the SQL login role.
// Review must remain fail-closed even when all PostgreSQL catalog flags pass.
test('structurally valid tenant RLS is not a trusted identity boundary',()=>{
 const table={enabled:true,forced:true};
 const policies=[{policyname:'portal_verified_tenant_comparison_select',
  permissive:'PERMISSIVE',cmd:'SELECT',roles:['public'],
  qual:"(client_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)"}];
 assert.deepEqual(evaluateComparisonRlsPolicy({table,policies}),
  {ready:false,reason:'comparison-tenant-setting-forgeable'});
});

test('strict customer portal and PDF fail closed when RLS verification is not ready',async()=>{
 for(const name of ['app/api/client-portal/route.js','app/api/client-portal/report/route.js']){
  const source=await readFile(new URL('../'+name,import.meta.url),'utf8');
  assert.match(source,/inspectComparisonRlsPolicy\(reader\)/);
  assert.match(source,/if\(!rls\.ready\)return privateJson\(/);
 }
});
