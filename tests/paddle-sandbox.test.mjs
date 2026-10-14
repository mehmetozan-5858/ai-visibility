import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {sandboxEnabled,sandboxClientToken,sandboxCatalog,verifyPaddleSignature,sandboxEvent,sandboxDatabaseUrl,recordSandboxEvent} from '../lib/paddle-sandbox.js';
const env={VERCEL_ENV:'preview',PADDLE_ENVIRONMENT:'sandbox',PADDLE_SANDBOX_ENABLED:'true'};
test('production and live tokens cannot enable sandbox checkout',()=>{
 assert.equal(sandboxEnabled(env),true);for(const change of [{VERCEL_ENV:'production'},{PADDLE_ENVIRONMENT:'live'},{PADDLE_SANDBOX_ENABLED:'false'},{VERCEL_ENV:undefined}])assert.equal(sandboxEnabled({...env,...change}),false);
 assert.equal(sandboxClientToken({...env,PADDLE_SANDBOX_CLIENT_TOKEN:'live_abc'}),'');assert.equal(sandboxClientToken({...env,PADDLE_SANDBOX_CLIENT_TOKEN:'test_abc'}),'test_abc');
});
test('catalog preserves eight fixed services across four currencies; quoted implementation excluded',()=>{
 for(const c of ['TRY','USD','EUR','GBP']){const rows=sandboxCatalog(c);assert.equal(rows.length,8);assert.equal(rows.filter(x=>x.kind==='monthly').length,4);assert.ok(rows.every(x=>x.currency===c&&/^pri_/.test(x.priceId)&&x.kind!=='from'));}
 assert.equal(sandboxCatalog('TRY').find(x=>x.code==='business-diagnosis').amount,4990);assert.throws(()=>sandboxCatalog('XYZ'));
});
test('raw signature resists tampering, old and future timestamps, malformed signatures and supports rotation',()=>{
 const raw='{"test":true}',ts=1000,secret='test-secret',h=createHmac('sha256',secret).update(`${ts}:${raw}`).digest('hex');
 const options={now:1000000};assert.equal(verifyPaddleSignature(raw,`ts=${ts};h1=${h}`,secret,options),true);
 assert.equal(verifyPaddleSignature(raw+' ',`ts=${ts};h1=${h}`,secret,options),false);
 for(const now of [1006000,994000])assert.equal(verifyPaddleSignature(raw,`ts=${ts};h1=${h}`,secret,{now}),false);
 assert.equal(verifyPaddleSignature(raw,`ts=1000;ts=1000;h1=${h}`,secret,options),false);
 assert.equal(verifyPaddleSignature(raw,`ts=1000;h1=invalid;h1=${h}`,secret,options),true);
});
const event={event_id:'evt_test',event_type:'subscription.updated',occurred_at:'2026-10-13T19:00:00Z',data:{id:'sub_test',status:'active',items:[{price:{id:sandboxCatalog('USD')[0].priceId}}]}};
test('unknown prices and malformed event identities fail closed',()=>{
 assert.equal(sandboxEvent(event).entityId,'sub_test');assert.throws(()=>sandboxEvent({...event,data:{...event.data,items:[{price:{id:'pri_unknown'}}]}}));assert.throws(()=>sandboxEvent({...event,event_id:'invalid'}));
});
test('test database cannot alias production by credentials, scheme or escaped database name',()=>{
 const prod='postgres://user:secret@db.example/app';for(const candidate of [prod,'postgresql://other:other@db.example:5432/%61pp'])assert.equal(sandboxDatabaseUrl({...env,DATABASE_URL:prod,PADDLE_SANDBOX_DATABASE_URL:candidate}),'');
 assert.equal(sandboxDatabaseUrl({...env,DATABASE_URL:prod,PADDLE_SANDBOX_DATABASE_URL:'postgres://x:y@db.example/test'}),'postgres://x:y@db.example/test');
});
test('duplicate events do not mutate entity state; storage failure rolls back and releases',async()=>{
 for(const mode of ['duplicate','failure']){const queries=[];let released=false;const db={connect:async()=>({query:async(sql)=>{queries.push(sql);if(sql.startsWith('INSERT INTO paddle_sandbox_events')){if(mode==='failure')throw Error('db unavailable');return {rows:[]}}return {rows:[]}},release:()=>released=true})};
  if(mode==='duplicate')assert.deepEqual(await recordSandboxEvent(event,db),{duplicate:true});else await assert.rejects(()=>recordSandboxEvent(event,db));
  assert.equal(released,true);assert.equal(queries.some(x=>x.startsWith('INSERT INTO paddle_sandbox_entities')),false);assert.ok(queries.includes(mode==='duplicate'?'COMMIT':'ROLLBACK'));
 }
});

test('signed Sandbox simulator event IDs are accepted only by the Sandbox parser',()=>{
 assert.equal(sandboxEvent({...event,event_id:'ntfsimevt_01m4ve0z7dt9ah77m0zfv4rss9'}).id,'ntfsimevt_01m4ve0z7dt9ah77m0zfv4rss9');
 assert.throws(()=>sandboxEvent({...event,event_id:'ntf_untrusted'}));
});
