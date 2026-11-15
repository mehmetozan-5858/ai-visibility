import test from 'node:test';
import assert from 'node:assert/strict';
import {confirmCardPaymentLockedReview} from '../lib/portal-card-activation-transaction-review.mjs';
const TENANT='11111111-1111-4111-8111-111111111111';
const PAYMENT='22222222-2222-4222-8222-222222222222';
const OID='cardtest001';
function fixture({failClient=false,missing=false,duplicate=false,changed=false,alreadyPaid=false}={}){
 const calls=[];
 let commit=false,rollback=false,paid=alreadyPaid,clientActive=false;
 const tx={release(){calls.push('RELEASE')},async query(sql,args){
  calls.push(sql.trim());
  if(sql.startsWith('SELECT pg_catalog.pg_advisory_xact_lock'))return {rows:[{}]};
  if(sql==='COMMIT'){commit=true;return {rows:[]}};
  if(sql==='ROLLBACK'){rollback=true;paid=alreadyPaid;clientActive=false;return {rows:[]}};
  if(sql.includes('UPDATE public.payments')){
   assert.equal(args[1],TENANT);assert.equal(args[2],OID);
   if(changed||paid)return {rows:[]};
   paid=true;return {rows:[{id:PAYMENT,clientId:TENANT,plan:'Starter',status:'paid'}]};
  }
  if(sql.includes('UPDATE public.clients')){
   if(failClient)throw Error('synthetic-client-write-failure');
   clientActive=true;return {rows:[{id:TENANT}]};
  }
  if(sql.includes('FROM public.payments WHERE id=')){
   return {rows:changed?[]:[{id:PAYMENT,clientId:TENANT,status:'paid'}]};
  }
  return {rows:[]};
 }};
 return {pool:{
  async query(sql,args){
   calls.push(sql.trim());
   assert.deepEqual(args,[OID]);
   return {rows:missing?[]:duplicate?
    [{id:PAYMENT,clientId:TENANT},{id:'33333333-3333-4333-8333-333333333333',clientId:TENANT}]:
    [{id:PAYMENT,clientId:TENANT}]};
  },async connect(){calls.push('CONNECT');return tx;}
 },calls,get state(){return {commit,rollback,paid,clientActive}}};
}
test('payment and client activation commit once after same tenant advisory lock',async()=>{
 const f=fixture();
 assert.equal((await confirmCardPaymentLockedReview(f.pool,OID)).status,'paid');
 assert.deepEqual(f.state,{commit:true,rollback:false,paid:true,clientActive:true});
 const lock=f.calls.findIndex(x=>x.startsWith('SELECT pg_catalog.pg_advisory_xact_lock'));
 const payment=f.calls.findIndex(x=>x.includes('UPDATE public.payments'));
 const client=f.calls.findIndex(x=>x.includes('UPDATE public.clients'));
 assert.ok(lock>=0&&lock<payment&&payment<client);
 assert.equal(f.calls.at(-1),'RELEASE');
});
test('client activation failure rolls back payment update and releases connection',async()=>{
 const f=fixture({failClient:true});
 await assert.rejects(confirmCardPaymentLockedReview(f.pool,OID),/synthetic-client-write-failure/);
 assert.deepEqual(f.state,{commit:false,rollback:true,paid:false,clientActive:false});
 assert.equal(f.calls.at(-1),'RELEASE');
});
test('duplicate or absent merchant payment denies before acquiring lock',async()=>{
 for(const opts of [{missing:true},{duplicate:true}]){
  const f=fixture(opts);
  await assert.rejects(confirmCardPaymentLockedReview(f.pool,OID),/review-card-payment-unresolved/);
  assert.equal(f.calls.includes('CONNECT'),false);
 }
});
test('payment changed after lookup rolls back instead of accepting a stale identity',async()=>{
 const f=fixture({changed:true});
 await assert.rejects(confirmCardPaymentLockedReview(f.pool,OID),/review-card-payment-changed/);
 assert.equal(f.state.rollback,true);
 assert.equal(f.state.commit,false);
});
test('already-paid repeat does not rewrite client activation',async()=>{
 const f=fixture({alreadyPaid:true});
 assert.equal((await confirmCardPaymentLockedReview(f.pool,OID)).status,'paid');
 assert.equal(f.state.clientActive,false);
 assert.equal(f.state.commit,true);
});
test('idempotent card confirmation refuses an unchanged non-paid row',async()=>{
 const f=fixture({changed:true});
 // A concurrent or unusual payment state can cause the conditional UPDATE
 // to return no rows while the identity lookup still finds a pending record.
 const original=f.pool.connect;
 f.pool.connect=async()=>{
  const tx=await original();
  const query=tx.query;
  tx.query=async(sql,args)=>{
   if(sql.includes('FROM public.payments WHERE id='))
    return {rows:[{id:PAYMENT,clientId:TENANT,status:'pending'}]};
   return query(sql,args);
  };
  return tx;
 };
 await assert.rejects(confirmCardPaymentLockedReview(f.pool,OID),
  /review-card-payment-changed/);
 assert.equal(f.state.commit,false);
 assert.equal(f.state.rollback,true);
});

test('malformed merchant ID rejects before database query',async()=>{
 const f=fixture();
 await assert.rejects(confirmCardPaymentLockedReview(f.pool,'not-valid!'),/review-card-confirmation-invalid/);
 assert.deepEqual(f.calls,[]);
});
