import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {completeCustomerPasswordReset} from '../lib/customer-password-reset.js';
const input={clientId:'own',email:'owner@example.com',code:'123456',password:'local-fixture-password',hashPassword:()=> 'fixture-hash'};
function fixture({credential=true,verified=true,write=true,failure=false}={}){
 const calls=[];let released=false;
 const tx={query:async(sql,args)=>{calls.push({sql,args});if(sql.startsWith('SELECT client_id'))return {rows:credential?[{client_id:'own'}]:[]};if(sql.startsWith('UPDATE client_email'))return {rows:verified?[{id:'code'}]:[]};if(sql.startsWith('UPDATE client_credentials')){if(failure)throw Error('database-private-diagnostic');return {rows:write?[{client_id:'own'}]:[]}}return {rows:[]}},release:()=>released=true};
 return {pool:{connect:async()=>tx},calls,get released(){return released}};
}
test('customer reset binds credential and code to one account and commits together',async()=>{
 const f=fixture();assert.equal(await completeCustomerPasswordReset(f.pool,input),true);
 for(const c of f.calls.filter(c=>c.sql.startsWith('SELECT')||c.sql.startsWith('UPDATE')))assert.deepEqual(c.args.slice(0,2),['own','owner@example.com']);
 assert.ok(f.calls.some(c=>c.sql.includes('FOR UPDATE')));assert.equal(f.calls.at(-1).sql,'COMMIT');assert.ok(f.released);
});
test('password write errors or zero updated rows roll back code consumption',async()=>{
 for(const config of [{failure:true},{write:false}]){const f=fixture(config);await assert.rejects(()=>completeCustomerPasswordReset(f.pool,input));assert.ok(f.calls.some(c=>c.sql.startsWith('UPDATE client_email')));assert.equal(f.calls.at(-1).sql,'ROLLBACK');assert.ok(!f.calls.some(c=>c.sql==='COMMIT'));assert.ok(f.released)}
});
test('missing owner credential, used/expired code and malformed code never change a password',async()=>{
 for(const config of [{credential:false},{verified:false}]){const f=fixture(config);await assert.rejects(()=>completeCustomerPasswordReset(f.pool,input),/verification-invalid/);assert.ok(!f.calls.some(c=>c.sql.startsWith('UPDATE client_credentials')))}
 const f=fixture();await assert.rejects(()=>completeCustomerPasswordReset(f.pool,{...input,code:'12x456'}),/verification-invalid/);assert.equal(f.calls.length,0);
});
const source=(await fs.readFile(new URL('../app/api/client-auth/password-reset/route.js',import.meta.url),'utf8')).replace(/^import .*;$/gm,'').replace(/export /g,'');
function endpoint({exists=true,error=null}={}){
 let sent=0,completed=0,lookups=0;
 const deps={getClientCredentialByEmail:async()=>{lookups++;return exists?{clientId:'own'}:null},withClientCredentialDatabase:fn=>fn({}),hashPassword:()=>'',createVerificationCode:async()=>({code:'123456'}),sendVerificationEmail:async()=>sent++,completeCustomerPasswordReset:async()=>{completed++;if(error)throw error},checkRateLimit:()=>null,enforceSameOrigin:()=>null};
 return {post:new Function(...Object.keys(deps),source+';return POST')(...Object.values(deps)),get sent(){return sent},get completed(){return completed},get lookups(){return lookups}};
}
const request=body=>new Request('https://example.com/api',{method:'POST',body:JSON.stringify(body)});
test('known and unknown request addresses return the same receipt; absent confirm cannot claim success',async()=>{
 const a=endpoint(),b=endpoint({exists:false});const body={action:'request',email:input.email};const ar=await a.post(request(body)),br=await b.post(request(body));assert.deepEqual(await ar.json(),await br.json());assert.equal(a.sent,1);assert.equal(b.sent,0);assert.equal(ar.headers.get('cache-control'),'no-store');
 const confirm=await b.post(request({...input,action:'confirm'}));assert.equal(confirm.status,400);assert.equal((await confirm.json()).ok,undefined);assert.equal(b.completed,0);
});
test('confirmation errors stay private and malformed actions never reach storage',async()=>{
 for(const [error,status] of [[Error('database-private-diagnostic'),500],[Error('verification-invalid-or-expired'),400]]){const f=endpoint({error});const res=await f.post(request({...input,action:'confirm'}));assert.equal(res.status,status);assert.ok(!(await res.text()).includes('database-private'));assert.equal(res.headers.get('cache-control'),'no-store')}
 const f=endpoint();for(const body of [null,[],{action:'unknown',email:input.email}])assert.equal((await f.post(request(body))).status,400);assert.equal(f.lookups,0);
});
