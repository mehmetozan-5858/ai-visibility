import test from 'node:test';
import assert from 'node:assert/strict';
import {stageBankConfirmationLockedReview} from '../lib/portal-bank-confirmation-staging-review.mjs';

const TENANT='11111111-1111-4111-8111-111111111111';
const PAYMENT='22222222-2222-4222-8222-222222222222';
const evidence={confirmed:true,amount:'10.00',currency:'EUR',
 invoiceReference:'INV-REVIEW-001',bankReference:'BANK-REVIEW-000001',
 valueDate:'2026-11-14'};
function fixture({missing=false,wrongTenant=false,already=false,conflict=false,conflictDate=false,
 failInsert=false,wrongStatus=false}={}){
 const calls=[];let released=0;
 const tx={release(){released++},async query(sql,args){
  calls.push(sql.trim());
  if(sql.includes('FROM public.payments WHERE id=$1 AND client_id=$2 FOR UPDATE'))
   return {rows:[{id:PAYMENT,clientId:wrongTenant?'33333333-3333-4333-8333-333333333333':TENANT,
    method:'bank-transfer',status:wrongStatus?'paid':'customer-reported',currency:'EUR',
    referenceCode:evidence.invoiceReference,setupAmount:10,monthlyAmount:0}]};
  if(sql.includes('FROM public.bank_confirmations WHERE'))
   return {rows:already||conflict||conflictDate?[{paymentId:conflict?TENANT:PAYMENT,amountMinor:1000,
      valueDate:conflictDate?'2026-11-13':evidence.valueDate,invoiceReference:evidence.invoiceReference}]:[]};
  if(sql.includes('INSERT INTO public.bank_confirmations')){
   if(failInsert)throw Error('fixture-bank-write-failed');
   return {rows:[{id:PAYMENT}]};
  }
  return {rows:[]};
 }};
 return {pool:{async query(){return {rows:missing?[]:[{clientId:TENANT}]};},
  async connect(){return tx;}},calls,get released(){return released}};
}
test('stages only evidence after transaction lock without changing payment or client access',async()=>{
 const f=fixture();const result=await stageBankConfirmationLockedReview(f.pool,PAYMENT,evidence);
 assert.deepEqual(result,{staged:true,alreadyStaged:false,verifiedSettlement:false,activated:false});
 const lock=f.calls.findIndex(x=>x.includes('pg_advisory_xact_lock'));
 const read=f.calls.findIndex(x=>x.includes('FOR UPDATE'));
 const insert=f.calls.findIndex(x=>x.includes('INSERT INTO public.bank_confirmations'));
 assert.ok(lock>=0&&lock<read&&read<insert);
 assert.equal(f.calls.some(x=>/UPDATE\s+(public\.)?(payments|clients)/i.test(x)),false);
 assert.equal(f.calls.at(-1),'COMMIT');assert.equal(f.released,1);
});
test('existing same reference is idempotent, conflicting references fail closed',async()=>{
 const a=fixture({already:true});
 assert.equal((await stageBankConfirmationLockedReview(a.pool,PAYMENT,evidence)).alreadyStaged,true);
 assert.equal(a.calls.some(x=>x.includes('INSERT INTO public.bank_confirmations')),false);
 const b=fixture({conflict:true});
 await assert.rejects(stageBankConfirmationLockedReview(b.pool,PAYMENT,evidence),/reference-conflict/);
 assert.equal(b.calls.at(-1),'ROLLBACK');assert.equal(b.released,1);
 const c=fixture({conflictDate:true});
 await assert.rejects(stageBankConfirmationLockedReview(c.pool,PAYMENT,evidence),/reference-conflict/);
 assert.equal(c.calls.at(-1),'ROLLBACK');
});
test('invalid or ineligible payments and failed insert do not commit',async()=>{
 for(const opts of [{missing:true},{wrongTenant:true},{wrongStatus:true},{failInsert:true}]){
  const f=fixture(opts);
  await assert.rejects(stageBankConfirmationLockedReview(f.pool,PAYMENT,evidence));
  assert.equal(f.calls.includes('COMMIT'),false);
  if(!opts.missing)assert.equal(f.calls.at(-1),'ROLLBACK');
 }
});
test('untrusted banking claim cannot omit confirmation or forge amount',async()=>{
 for(const patch of [{confirmed:false},{amount:'9.99'},{currency:'USD'}]){
  const f=fixture();
  await assert.rejects(stageBankConfirmationLockedReview(f.pool,PAYMENT,{...evidence,...patch}));
  assert.equal(f.calls.at(-1),'ROLLBACK');
 }
});
