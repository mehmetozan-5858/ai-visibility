import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {dispatchSignedPaddleEventWithTenantLockReview}
 from '../lib/portal-paddle-locked-dispatch-review.mjs';
import {
 applyOwnedPaddleCompletionReview,READ_OWNED_PAYMENT_FOR_COMPLETION_SQL,
 MARK_VERIFIED_PADDLE_PAYMENT_SQL,INSERT_VERIFIED_PADDLE_PROOF_SQL
} from '../lib/portal-paddle-completion-write-review.mjs';
import {PILOT_LOCK_SQL} from '../lib/portal-pilot-advisory-lock-review.mjs';

const A='11111111-1111-4111-8111-111111111111',P='22222222-2222-4222-8222-222222222222';
const secret='synthetic-paddle-completion-review-secret-123';
const data=()=>({id:'txn_reviewcompleted123',status:'completed',currency_code:'EUR',
 origin:'api',custom_data:{client_id:A,payment_id:P},
 items:[{quantity:1,price:{unit_price:{amount:'16900'},tax_mode:'internal'}}],
 details:{totals:{subtotal:'16900',discount:'0',tax:'0',total:'16900',
  credit:'0',credit_to_balance:'0',balance:'0',grand_total:'16900',currency_code:'EUR'}}});
function signed(overrides={}){
 const raw=JSON.stringify({event_id:'evt_reviewsettle123',
  event_type:'transaction.completed',occurred_at:'2026-11-15T10:30:00Z',
  data:{...data(),...overrides}});
 const ts=Math.floor(Date.now()/1000);
 return {raw,secret,header:`ts=${ts};h1=${createHmac('sha256',secret).update(`${ts}:${raw}`).digest('hex')}`};
}
function fixture({status='customer-reported',owned=true,conflict=false,
 badCurrency=false,failProof=false,method='paddle'}={}){
 const calls=[];let released=0,connects=0;
 const tx={async query(sql,args=[]){
  calls.push({sql,args});
  if(sql===READ_OWNED_PAYMENT_FOR_COMPLETION_SQL)
   return {rows:owned?[{id:P,client_id:A,status,
    method,currency:badCurrency?'USD':'EUR',setup_amount:120,monthly_amount:49}]:[]};
  if(sql===MARK_VERIFIED_PADDLE_PAYMENT_SQL)
   return {rows:conflict?[]:[{id:P,client_id:A}]};
  if(sql===INSERT_VERIFIED_PADDLE_PROOF_SQL){
   if(failProof)throw Error('synthetic-proof-write-failed');
   return {rows:conflict?[]:[{payment_id:P}]};
  }
  return {rows:[]};
 },release(){released++}};
 return {pool:{connect:async()=>{connects++;return tx}},calls,
  get connects(){return connects},get released(){return released}};
}
const dispatch=(f,body=signed())=>dispatchSignedPaddleEventWithTenantLockReview({
 ...body,pool:f.pool,write:applyOwnedPaddleCompletionReview});
test('signed final paid completion locks tenant, validates totals, records durable proof atomically WITHOUT activating account',async()=>{
 const f=fixture();
 assert.deepEqual(await dispatch(f),
  {paymentChanged:true,settlementRecorded:true,accountActivated:false});
 assert.deepEqual(f.calls.slice(3,7).map(c=>c.sql),[
  PILOT_LOCK_SQL,READ_OWNED_PAYMENT_FOR_COMPLETION_SQL,
  MARK_VERIFIED_PADDLE_PAYMENT_SQL,INSERT_VERIFIED_PADDLE_PROOF_SQL]);
 assert.deepEqual(f.calls[4].args,[P,A]);
 assert.deepEqual(f.calls[5].args,[P,A,'2026-11-15T10:30:00Z']);
 assert.deepEqual(f.calls[6].args,[P,A,'evt_reviewsettle123','txn_reviewcompleted123']);
 assert.equal(f.calls.at(-1).sql,'COMMIT');
 assert.equal(f.calls.some(c=>/UPDATE public\.clients|UPDATE clients/.test(c.sql)),false);
 assert.equal(f.released,1);
});
test('already paid and refunded payments cannot create a new proof or activation',async()=>{
 for(const status of ['paid','refunded']){
  const f=fixture({status});
  assert.deepEqual(await dispatch(f),{paymentChanged:false,reason:'already-paid-or-refunded'});
  assert.equal(f.calls.some(c=>c.sql===MARK_VERIFIED_PADDLE_PAYMENT_SQL),false);
  assert.equal(f.calls.some(c=>c.sql===INSERT_VERIFIED_PADDLE_PROOF_SQL),false);
 }
});
test('unowned payment, wrong currency, discounted final amount or renewal must fail closed',async()=>{
 const cases=[
  [fixture({owned:false}),signed()],
  [fixture({badCurrency:true}),signed()],
  [fixture(),signed({details:{totals:{...data().details.totals,discount:'100'}}})],
  [fixture(),signed({origin:'subscription_recurring'})]
 ];
 for(const [f,input] of cases){
  await assert.rejects(dispatch(f,input));
  assert.equal(f.calls.some(c=>c.sql===INSERT_VERIFIED_PADDLE_PROOF_SQL),false);
  assert.equal(f.calls.at(-1).sql,'ROLLBACK');
 }
});
test('failed proof persistence or payment ownership conflict rolls back the payment update',async()=>{
 for(const opts of [{failProof:true},{conflict:true}]){
  const f=fixture(opts);
  await assert.rejects(dispatch(f));
  assert.equal(f.calls.at(-1).sql,'ROLLBACK');
  assert.equal(f.calls.some(c=>c.sql==='COMMIT'),false);
  assert.equal(f.released,1);
 }
});
test('bad Paddle signature cannot create transaction connection',async()=>{
 const f=fixture();
 await assert.rejects(dispatch(f,{...signed(),header:'ts=1;h1='+('0'.repeat(64))}),
  /review-webhook-signature-required/);
 assert.equal(f.connects,0);
});

test('failed, cancelled and bank-transfer invoices cannot be converted to Paddle paid proof',async()=>{
 for(const opts of [
  {status:'failed'},
  {status:'canceled'},
  {status:'payment-review'},
  {status:'pending',method:'bank-transfer'},
  {status:'customer-reported',method:'manual'}
 ]){
  const f=fixture(opts);
  await assert.rejects(dispatch(f),/review-completion-payment-ineligible/);
  assert.equal(f.calls.some(c=>c.sql===MARK_VERIFIED_PADDLE_PAYMENT_SQL),false);
  assert.equal(f.calls.some(c=>c.sql===INSERT_VERIFIED_PADDLE_PROOF_SQL),false);
  assert.equal(f.calls.at(-1).sql,'ROLLBACK');
 }
});
