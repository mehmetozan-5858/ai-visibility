import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Execute the actual route body with an isolated database adapter. No remote
// credentials, customer data, or provider network requests are used.
async function accountRoute({enabled=true,session={clientId:'customer-a'},failure=false}={}){
 const source=await readFile(new URL('../app/api/paddle-sandbox/account/route.js',import.meta.url),'utf8');
 const observations={queries:[],opened:0,closed:0};
 const records=[{client:'customer-a',service_code:'business-monitoring',status:'active',event_type:'subscription.activated'},{client:'customer-b',service_code:'social-monitoring-1',status:'canceled',event_type:'subscription.canceled'}];
 class Pool{
  constructor(){observations.opened++}
  async query(sql,args){
   observations.queries.push({sql,args});
   if(failure)throw Error('private-connection-string-and-database-error');
   if(!/WHERE i\.client_id=\$1/.test(sql))throw Error('missing-owner-filter');
   return {rows:records.filter(row=>row.client===args[0]).map(({client,...row})=>row)};
  }
  async end(){observations.closed++}
 }
 const body=source.replace(/^import .*;\n/gm,'').replace(/export const runtime=.*;\n/,'').replace('export async function GET','async function GET');
 const GET=new Function('pg','sandboxEnabled','sandboxDatabaseUrl','sandboxClientSession',`${body};return GET`)(
  {Pool},()=>enabled,()=> 'isolated-fixture-db',async()=>session);
 return {GET,observations};
}
test('production-disabled account endpoint never opens a database',async()=>{
 const {GET,observations}=await accountRoute({enabled:false});
 assert.equal((await GET(new Request('https://fixture.example/api/paddle-sandbox/account'))).status,404);
 assert.equal(observations.opened,0);
});
test('unauthenticated account endpoint never opens a database',async()=>{
 const {GET,observations}=await accountRoute({session:null});
 assert.equal((await GET(new Request('https://fixture.example/api/paddle-sandbox/account'))).status,401);
 assert.equal(observations.opened,0);
});
test('customer account response ignores a requested foreign customer and returns only session-owned state',async()=>{
 const {GET,observations}=await accountRoute();
 const response=await GET(new Request('https://fixture.example/api/paddle-sandbox/account?clientId=customer-b'));
 assert.equal(response.status,200);
 assert.equal(response.headers.get('cache-control'),'no-store');
 assert.deepEqual(await response.json(),{records:[{service_code:'business-monitoring',status:'active',event_type:'subscription.activated'}],productionAccessChanged:false});
 assert.deepEqual(observations.queries[0].args,['customer-a']);
 assert.equal(observations.closed,1);
});
test('a second customer sees its own cancellation without the first customer subscription',async()=>{
 const {GET}=await accountRoute({session:{clientId:'customer-b'}});
 const response=await GET(new Request('https://fixture.example/api/paddle-sandbox/account?clientId=customer-a'));
 assert.deepEqual((await response.json()).records,[{service_code:'social-monitoring-1',status:'canceled',event_type:'subscription.canceled'}]);
});
test('database failure closes the connection and returns a safe non-cached response',async()=>{
 const {GET,observations}=await accountRoute({failure:true});
 const response=await GET(new Request('https://fixture.example/api/paddle-sandbox/account'));
 assert.equal(response.status,503);
 assert.equal(response.headers.get('cache-control'),'no-store');
 assert.equal((await response.text()).includes('private-connection'),false);
 assert.equal(observations.closed,1);
});
