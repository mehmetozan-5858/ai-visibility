import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectPortalReaderPrivileges,portalReaderRequiredTables} from '../lib/portal-role-readiness.mjs';

// REVIEW ONLY: prove that a pooled runtime role check reads role identity and
// table privileges on the same pinned PostgreSQL connection.
const meta={
 role:'portal_reader_ci',canLogin:true,superuser:false,bypassRls:false,
 canCreateDatabase:false,canCreateRole:false,replication:false,
 schemaUsage:true,canCreateSchema:false,credentialsSelect:false
};
const grants=portalReaderRequiredTables.map(table=>({
 table,select:true,insert:false,update:false,delete:false,
 truncate:false,references:false,trigger:false
}));

test('runtime role and table permissions are probed on the same acquired backend',async()=>{
 const calls=[];
 const pool={
  async query(){throw Error('pool-query-must-not-be-used')},
  async connect(){
   calls.push('connect');
   return {
    async query(sql,args){
     calls.push(sql.includes('FROM pg_roles')?'role':'grants');
     if(sql.includes('FROM pg_roles'))return {rows:[meta]};
     assert.deepEqual(args,[portalReaderRequiredTables]);
     return {rows:grants};
    },
    release(){calls.push('release')}
   };
  }
 };
 assert.equal((await inspectPortalReaderPrivileges(pool)).ready,true);
 assert.deepEqual(calls,['connect','role','grants','release']);
});

test('a failed privilege query denies access and releases pinned backend',async()=>{
 const calls=[];
 const pool={
  async connect(){
   calls.push('connect');
   let n=0;
   return {
    async query(){
     n++;
     if(n===1)return {rows:[meta]};
     throw Error('synthetic-privilege-probe-unavailable');
    },
    release(){calls.push('release')}
   };
  }
 };
 const result=await inspectPortalReaderPrivileges(pool);
 assert.deepEqual(result,{ready:false,reason:'role-inspection-unavailable'});
 assert.deepEqual(calls,['connect','release']);
});

test('pool may not substitute a connection without release',async()=>{
 const pool={async connect(){return {query:async()=>({rows:[meta]})}}};
 assert.deepEqual(await inspectPortalReaderPrivileges(pool),
  {ready:false,reason:'role-inspection-unavailable'});
});
