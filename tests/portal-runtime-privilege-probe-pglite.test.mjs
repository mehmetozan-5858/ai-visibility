import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {portalReaderRequiredTables,evaluatePortalReaderPrivileges,inspectPortalReaderPrivileges} from '../lib/portal-role-readiness.mjs';

const role='isolated_portal_runtime';
test('runtime privilege probe fails closed on missing or elevated privileges',()=>{
 const allowed={role,canLogin:true,superuser:false,bypassRls:false,canCreateSchema:false,
  schemaUsage:true,credentialsSelect:false,tables:portalReaderRequiredTables.map(table=>({
   table,select:true,insert:false,update:false,delete:false,truncate:false,references:false,trigger:false
  }))};
 assert.equal(evaluatePortalReaderPrivileges(allowed).ready,true);
 for(const patch of [{canLogin:false},{superuser:true},{bypassRls:true},
  {canCreateSchema:true},{credentialsSelect:true},{schemaUsage:false},
  {tables:allowed.tables.slice(1)},
  {tables:allowed.tables.map((v,i)=>i===0?{...v,update:true}:v)}]){
  assert.equal(evaluatePortalReaderPrivileges({...allowed,...patch}).ready,false);
 }
 assert.equal(evaluatePortalReaderPrivileges({...allowed,tables:[...allowed.tables.slice(1),allowed.tables[1]]}).ready,false);
});

test('runtime reader privileges inspected using the actual current SQL role',async()=>{
 const db=new PGlite();
 try{
  for(const table of [...portalReaderRequiredTables,'client_credentials']){
   await db.exec(`CREATE TABLE public.${table}(id UUID PRIMARY KEY)`);
  }
  await db.exec(`CREATE ROLE isolated_portal_runtime LOGIN;
   REVOKE ALL ON public.client_credentials FROM PUBLIC;
   GRANT USAGE ON SCHEMA public TO isolated_portal_runtime;
   GRANT SELECT ON ${portalReaderRequiredTables.map(t=>'public.'+t).join(',')} TO isolated_portal_runtime;`);
  const owner=await inspectPortalReaderPrivileges(db);
  assert.equal(owner.ready,false);
  await db.exec('SET ROLE isolated_portal_runtime');
  const result=await inspectPortalReaderPrivileges(db);
  assert.equal(result.ready,true,JSON.stringify(result));
  await assert.rejects(db.query('SELECT * FROM public.client_credentials'),/permission denied/i);
  await assert.rejects(db.exec('CREATE TABLE public.not_authorized(id INT)'),/permission denied/i);
  await db.exec('RESET ROLE');
 }finally{await db.close()}
});

test('runtime role probe never claims acceptance on unavailable database',async()=>{
 assert.deepEqual(await inspectPortalReaderPrivileges(null),{ready:false,reason:'role-inspection-unavailable'});
 assert.deepEqual(await inspectPortalReaderPrivileges({query:async()=>{throw Error('offline')}}),{ready:false,reason:'role-inspection-unavailable'});
});

test('portal read privilege inventory covers actual comparison and strict settlement lookup',()=>{
 for(const name of ['ai_provider_comparisons','verified_customer_settlements']){
  assert.ok(portalReaderRequiredTables.includes(name),name+' missing from role inventory');
 }
 assert.equal(new Set(portalReaderRequiredTables).size,portalReaderRequiredTables.length);
 const base={role,canLogin:true,superuser:false,bypassRls:false,canCreateSchema:false,
  schemaUsage:true,credentialsSelect:false,tables:portalReaderRequiredTables.map(table=>({
   table,select:true,insert:false,update:false,delete:false,truncate:false,references:false,trigger:false
  }))};
 assert.equal(evaluatePortalReaderPrivileges(base).ready,true);
 assert.equal(evaluatePortalReaderPrivileges({...base,
  tables:base.tables.filter(t=>t.table!=='verified_customer_settlements')}).ready,false);
 assert.equal(evaluatePortalReaderPrivileges({...base,
  tables:base.tables.map(t=>t.table==='ai_provider_comparisons'?{...t,select:false}:t)}).ready,false);
});
