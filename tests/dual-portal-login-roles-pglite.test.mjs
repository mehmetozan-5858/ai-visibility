import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {inspectPortalReaderPrivileges,portalReaderRequiredTables} from '../lib/portal-role-readiness.mjs';
import {inspectCredentialReaderPrivileges,evaluateCredentialReaderPrivileges} from '../lib/credential-role-readiness.mjs';

const roles=['isolated_portal_reader','isolated_login_reader'];
test('independent PostgreSQL roles can serve portal and credential reads with mutually exclusive access',async()=>{
 const db=new PGlite();
 try{
  for(const name of ['client_credentials',...portalReaderRequiredTables])
   await db.exec('CREATE TABLE public.'+name+'(id UUID PRIMARY KEY)');
  await db.exec(`CREATE ROLE ${roles[0]} LOGIN; CREATE ROLE ${roles[1]} LOGIN;
   REVOKE ALL ON public.client_credentials FROM PUBLIC;
   GRANT USAGE ON SCHEMA public TO ${roles[0]},${roles[1]};
   GRANT SELECT ON ${portalReaderRequiredTables.map(name=>'public.'+name).join(',')} TO ${roles[0]};
   GRANT SELECT ON public.client_credentials TO ${roles[1]};`);
  await db.exec('SET ROLE '+roles[0]);
  const portal=await inspectPortalReaderPrivileges(db);
  assert.equal(portal.ready,true,JSON.stringify(portal));
  assert.equal((await inspectCredentialReaderPrivileges(db)).ready,false);
  await assert.rejects(db.query('SELECT * FROM public.client_credentials'),/permission denied/i);
  await db.exec('RESET ROLE');
  await db.exec('SET ROLE '+roles[1]);
  const login=await inspectCredentialReaderPrivileges(db);
  assert.equal(login.ready,true,JSON.stringify(login));
  assert.equal((await inspectPortalReaderPrivileges(db)).ready,false);
  assert.equal((await db.query('SELECT count(*)::int AS count FROM public.client_credentials')).rows[0].count,0);
  await assert.rejects(db.query('SELECT * FROM public.payments'),/permission denied/i);
  await assert.rejects(db.exec('CREATE TABLE public.unauthorized_role_ddl(id INT)'),/permission denied/i);
  await db.exec('RESET ROLE');
 }finally{await db.close()}
});

test('credential reader preflight rejects cross-role leakage or writes',()=>{
 const other=portalReaderRequiredTables.map(table=>({table,select:false,insert:false,
  update:false,delete:false,truncate:false,references:false,trigger:false}));
 const permitted={role:roles[1],canLogin:true,superuser:false,bypassRls:false,canCreateDatabase:false,canCreateRole:false,replication:false,
  schemaUsage:true,canCreateSchema:false,
  credentialTable:{table:'client_credentials',select:true,insert:false,update:false,delete:false,truncate:false,references:false,trigger:false},
  otherTables:other};
 assert.equal(evaluateCredentialReaderPrivileges(permitted).ready,true);
 for(const values of [
  {credentialTable:{...permitted.credentialTable,update:true}},
  {credentialTable:{...permitted.credentialTable,select:false}},
  {otherTables:other.map(x=>x.table==='payments'?{...x,select:true}:x)},
  {canCreateSchema:true},{canCreateDatabase:true},{canCreateRole:true},{replication:true},{bypassRls:true},{canLogin:false}
 ]) assert.equal(evaluateCredentialReaderPrivileges({...permitted,...values}).ready,false);
 assert.equal(evaluateCredentialReaderPrivileges({...permitted,otherTables:other.slice(1)}).ready,false);
});

test('credential role preflight denies database outages',async()=>{
 assert.deepEqual(await inspectCredentialReaderPrivileges(null),
  {ready:false,reason:'credential-role-inspection-unavailable'});
 assert.deepEqual(await inspectCredentialReaderPrivileges({query:async()=>{throw Error('offline')}}),
  {ready:false,reason:'credential-role-inspection-unavailable'});
});
