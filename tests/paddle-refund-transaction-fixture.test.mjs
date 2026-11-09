import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';

// Isolated transactional SQL fixture: no production database, network or payment.
const source=readFileSync(new URL('../lib/paddle-live.js',import.meta.url),'utf8')
  .replace(/^import .*;\s*$/gm,'').replace(/export /g,'');

test('signed completed event cannot revive refunded payment or client access',async()=>{
 const calls=[];
 const paymentId='550e8400-e29b-41d4-a716-446655440000';
 const clientId='550e8400-e29b-41d4-a716-446655440001';
 const tx={
   async query(sql){
     calls.push(sql);
     if(sql.includes('SELECT id,client_id,status,currency,plan,setup_amount,monthly_amount'))
       return {rows:[{id:paymentId,client_id:clientId,status:'refunded',currency:'EUR',plan:'test-plan',setup_amount:0,monthly_amount:49}]};
     if(sql.startsWith('INSERT INTO paddle_live_events'))return {rows:[{event_id:'evt_testabc'}]};
     if(sql.startsWith('INSERT INTO paddle_live_entities'))return {rows:[{entity_id:'txn_testabc'}]};
     return {rows:[]};
   },
   release(){calls.push('release')}
 };
 const pool={query:sql=>tx.query(sql),connect:async()=>tx};
 const record=new Function('databasePool','getDatabaseUrl','randomUUID',source+';return recordPaddleLiveEvent;')(
   ()=>pool,()=> 'postgres://fixture-only',randomUUID
 );
 const response=await record({event_id:'evt_testabc',event_type:'transaction.completed',
   occurred_at:'2026-11-01T00:00:00Z',
   data:{id:'txn_testabc',status:'completed',origin:'api',currency_code:'EUR',
     items:[{quantity:1,price:{unit_price:{amount:'4900'}}}],
     custom_data:{payment_id:paymentId,client_id:clientId}}});
 assert.equal(response.recorded,true);
 assert.equal(response.paymentChanged,false);
 assert.ok(calls.includes('COMMIT'));
 assert.ok(!calls.some(sql=>sql.startsWith('UPDATE clients')));
 assert.ok(!calls.some(sql=>sql.startsWith("UPDATE payments SET status='paid'")&& !sql.includes("status NOT IN ('paid','refunded')")));
 assert.equal(calls.at(-1),'release');
});
