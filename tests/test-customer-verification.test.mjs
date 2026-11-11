import test from 'node:test';import assert from 'node:assert/strict';
import {completeTestCredential} from '../lib/test-customer-verification.js';
const input={client:{id:'synthetic-client',name:'AI Visibility Test Müşteri',domain:'test.ai-visibility.local'},email:'operator@example.com',code:'123456',password:'local-test-only-password',hashPassword:()=> 'test-hash'};
function fixture({existing=null,owner=null,valid=true,failWrite=false}={}){const queries=[];let released=false;const tx={query:async(sql,args)=>{queries.push({sql,args});if(sql.startsWith('SELECT email'))return {rows:existing?[existing]:[]};if(sql.startsWith('SELECT client_id'))return {rows:owner?[{client_id:owner}]:[]};if(sql.startsWith('UPDATE client_email'))return {rows:valid?[{id:'verification'}]:[]};if(sql.startsWith('INSERT INTO client_credentials')||sql.startsWith('UPDATE client_credentials')){if(failWrite)throw Error('storage-error');return {rows:[{client_id:'synthetic-client'}]}}return {rows:[]}},release:()=>released=true};return {pool:{connect:async()=>tx},queries,get released(){return released}}}
test('existing synthetic credential cannot be overwritten or consume a verification code',async()=>{
 const f=fixture({existing:{email:'old-test@example.com'}});let hashes=0;
 await assert.rejects(()=>completeTestCredential(f.pool,{...input,hashPassword:()=>{hashes++;return 'forbidden'}}),/test-credential-already-exists/);
 assert.equal(hashes,0);assert.equal(f.queries.some(x=>x.sql.startsWith('UPDATE client_email')||x.sql.startsWith('INSERT INTO client_credentials')||x.sql.startsWith('UPDATE client_credentials')),false);
 assert.ok(f.queries.some(x=>x.sql==='ROLLBACK'));assert.ok(f.released);
});
test('credential storage failure rolls back verification consumption so a valid code remains retryable',async()=>{const f=fixture({failWrite:true});await assert.rejects(()=>completeTestCredential(f.pool,input));assert.ok(f.queries.some(x=>x.sql.startsWith('UPDATE client_email')));assert.ok(f.queries.some(x=>x.sql==='ROLLBACK'));assert.equal(f.queries.some(x=>x.sql==='COMMIT'),false);assert.ok(f.released)});
test('email owned by another account rejects before consuming code or overwriting credentials',async()=>{const f=fixture({owner:'real-other-client'});await assert.rejects(()=>completeTestCredential(f.pool,input),/test-email-in-use/);assert.equal(f.queries.some(x=>x.sql.startsWith('UPDATE client_email')||x.sql.startsWith('INSERT INTO client_credentials')),false)});
test('invalid code and non-synthetic client fail closed without credential changes',async()=>{const f=fixture({valid:false});await assert.rejects(()=>completeTestCredential(f.pool,input),/verification-invalid/);assert.equal(f.queries.some(x=>x.sql.startsWith('INSERT INTO client_credentials')),false);await assert.rejects(()=>completeTestCredential(f.pool,{...input,client:{...input.client,domain:'real.example'}}),/test-client-mismatch/)});

test('PostgreSQL preserves an existing hash, update timestamp and unused code when a test is rerun',async()=>{
 const {PGlite}=await import('@electric-sql/pglite');const db=new PGlite();
 try{
  await db.exec("CREATE TABLE client_credentials(client_id TEXT PRIMARY KEY,email TEXT,password_hash TEXT,updated_at TIMESTAMPTZ);CREATE TABLE client_email_verifications(id TEXT,verified_at TIMESTAMPTZ);INSERT INTO client_credentials VALUES('synthetic-client','old-test@example.com','fixture-original-hash','2026-10-16T15:31:47Z');INSERT INTO client_email_verifications VALUES('unused',NULL)");
  const before=(await db.query('SELECT * FROM client_credentials')).rows;
  const pool={connect:async()=>({query:(...a)=>db.query(...a),release(){}})};
  await assert.rejects(completeTestCredential(pool,{...input,hashPassword:()=>{throw Error('must-not-hash')}}),/test-credential-already-exists/);
  assert.deepEqual((await db.query('SELECT * FROM client_credentials')).rows,before);
  assert.equal((await db.query('SELECT verified_at FROM client_email_verifications')).rows[0].verified_at,null);
 }finally{await db.close()}
});
test('admin start refuses an existing credential before preparing data or sending a code',async()=>{
 const {readFile}=await import('node:fs/promises');
 const source=(await readFile(new URL('../app/api/admin-test-flow/route.js',import.meta.url),'utf8')).replace(/^import .*;\s*$/gm,'').replace(/export /g,'');
 const post=new Function('requireAdmin','enforceSameOrigin','checkRateLimit','process','findClientByIdentity','getClientCredential',source+';return POST;')(
  async()=>null,()=>null,()=>null,{env:{ADMIN_RECOVERY_EMAIL:'operator@example.com'}},async()=>input.client,async()=>({email:'existing@example.com'}));
 const response=await post(new Request('https://example.invalid/api/admin-test-flow',{method:'POST',body:JSON.stringify({action:'start'})}));
 assert.equal(response.status,409);const body=await response.json();assert.equal(body.code,'test-credential-exists');assert.equal(body.password,undefined);
});
