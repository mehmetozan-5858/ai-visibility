import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Extract the private function and run it with a strict isolated SQL stub.
const source=readFileSync(new URL('../lib/paddle-live.js',import.meta.url),'utf8');
const start=source.indexOf('async function applySubscriptionAccess(');
const end=source.indexOf('\nexport async function recordPaddleLiveEvent',start);
assert.ok(start>=0&&end>start);
const apply=new Function('UUID','subscriptionAccessState',source.slice(start,end)+';return applySubscriptionAccess;')(
 /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
 item=>item.type==='subscription.canceled'?'payment-review':item.type==='subscription.activated'?'active':null
);
const client='550e8400-e29b-41d4-a716-446655440001';
const payment='550e8400-e29b-41d4-a716-446655440000';
function fixture(owned){const queries=[];return {queries,tx:{async query(sql,args){queries.push({sql,args});if(sql.includes('SELECT id FROM payments'))return {rows:owned?[{id:payment}]:[]};if(sql.includes('UPDATE clients'))return {rows:[{id:client}]};throw Error('unexpected SQL')}}};}
for(const type of ['subscription.canceled','subscription.activated']){
 test(type+' cannot change another customer without owned payment',async()=>{
  const f=fixture(false);const result=await apply(f.tx,{type,clientId:client,paymentId:payment});
  assert.equal(result.accessChanged,false);assert.equal(result.reason,'payment-not-found');
  assert.equal(f.queries.some(q=>q.sql.includes('UPDATE clients')),false);
  assert.deepEqual(f.queries[0].args,[payment,client]);
 });
 test(type+' requires owned payment to reach customer update',async()=>{
  const f=fixture(true);const result=await apply(f.tx,{type,clientId:client,paymentId:payment});
  assert.equal(result.accessChanged,true);
  assert.ok(f.queries[0].sql.includes('FOR UPDATE'));
 });
}
test('subscription without payment linkage cannot affect account',async()=>{
 const f=fixture(true);const result=await apply(f.tx,{type:'subscription.canceled',clientId:client,paymentId:''});
 assert.equal(result.accessChanged,false);assert.equal(f.queries.length,0);
});
