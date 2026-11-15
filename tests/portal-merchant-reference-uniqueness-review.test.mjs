import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveUniqueMerchantPaymentWithLockReview} from '../lib/portal-merchant-reference-uniqueness-review.mjs';
import {PILOT_LOCK_SQL} from '../lib/portal-pilot-advisory-lock-review.mjs';

const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const ID1='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ID2='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const OID='12345678abcde';
const row=(id,clientId)=>({id,clientId});
function fixture(first,second=first){
 const calls=[],snapshots=[first,second];
 const tx={query:async(sql,args=[])=>{
  calls.push({sql,args});
  if(sql.includes('FROM public.payments'))
   return {rows:snapshots.shift()??[]};
  return {rows:[]};
 }};
 return {tx,calls};
}

test('one stored payment is resolved, locked and reverified using its unique ID',async()=>{
 const f=fixture([row(ID1,A)],[row(ID1,A)]);
 assert.deepEqual(await resolveUniqueMerchantPaymentWithLockReview(f.tx,OID),{paymentId:ID1,tenantId:A});
 assert.equal(f.calls.length,3);
 assert.match(f.calls[0].sql,/ORDER BY id LIMIT 2/);
 assert.equal(f.calls[1].sql,PILOT_LOCK_SQL);
 assert.deepEqual(f.calls[1].args,[A]);
 assert.deepEqual(f.calls[2].args,[OID]);
});

for(const [label,rows] of [
 ['missing payment',[]],
 ['ambiguous normalized reference',[row(ID1,A),row(ID2,B)]],
 ['two different references from same tenant',[row(ID1,A),row(ID2,A)]],
 ['malformed stored payment identity',[row('not-a-uuid',A)]]
]){
 test(label+' never takes an advisory lock or calls a write',async()=>{
  const f=fixture(rows);
  await assert.rejects(resolveUniqueMerchantPaymentWithLockReview(f.tx,OID),/merchant-reference-not-unique/);
  assert.equal(f.calls.length,1);
  assert.match(f.calls[0].sql,/LIMIT 2/);
 });
}
for(const [label,second] of [
 ['tenant changed',[row(ID1,B)]],
 ['payment ID changed',[row(ID2,A)]],
 ['second matching payment appeared',[row(ID1,A),row(ID2,B)]],
 ['payment disappeared',[]]
]){
 test('revalidation under lock denies '+label,async()=>{
  const f=fixture([row(ID1,A)],second);
  await assert.rejects(resolveUniqueMerchantPaymentWithLockReview(f.tx,OID),/merchant-reference-changed|merchant-reference-not-unique/);
  assert.deepEqual(f.calls[1].args,[A]);
  assert.equal(f.calls.length,3);
 });
}
test('invalid or direct tenant lookup inputs are denied before SQL',async()=>{
 const f=fixture([row(ID1,A)]);
 for(const value of [null,undefined,'',A,'abc','abc-def','!bad-ref',{},'x'.repeat(129)])
  await assert.rejects(resolveUniqueMerchantPaymentWithLockReview(f.tx,value),/merchant-reference-unverified/);
 assert.equal(f.calls.length,0);
});
test('existing payment activation is still NOT wired to this review helper',async()=>{
 const {readFile}=await import('node:fs/promises');
 const source=await readFile(new URL('../lib/repository.js',import.meta.url),'utf8');
 assert.match(source,/confirmCardPaymentByMerchantOid/);
 assert.doesNotMatch(source,/resolveUniqueMerchantPaymentWithLockReview/);
});
