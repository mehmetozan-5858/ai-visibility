import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

// REVIEW ONLY: compare the real production validator's function bodies with
// the isolated staging validator without importing its bundler-only DB runtime.
// This neither verifies the underlying bank transfer nor enables paid access.
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
function extract(source,startMarker,endMarker){
 const start=source.indexOf(startMarker);
 const end=source.indexOf(endMarker,start+startMarker.length);
 assert.ok(start>=0&&end>start,'validator source boundary changed');
 return source.slice(start,end).replace(/export\s+function\s+/g,'function ');
}
function createValidator(body){
 const sandbox=vm.createContext({});
 return vm.runInContext(body+'\nvalidateBankConfirmation',sandbox,{timeout:1500});
}
const now=new Date('2026-11-15T10:00:00Z');
const invoice={id:'22222222-2222-4222-8222-222222222222',
 method:'bank-transfer',currency:'EUR',referenceCode:'INV-REVIEW-001',
 setupAmount:10,monthlyAmount:0};
const valid={confirmed:true,amount:'10.00',currency:'EUR',
 invoiceReference:'INV-REVIEW-001',bankReference:'BANK-REVIEW-000001',
 valueDate:'2026-11-14'};
function outcome(fn,bill,claim){
 try{return {ok:true,value:JSON.parse(JSON.stringify(fn(bill,claim,now)))}}
 catch(e){return {ok:false,error:String(e?.message||e)}}
}
test('isolated bank staging validation matches production validator for acceptance and denial',async()=>{
 const [prod,review]=await Promise.all([
  read('lib/bank-confirmation.js'),
  read('lib/portal-bank-confirmation-staging-review.mjs')
 ]);
 const production=createValidator(extract(prod,'function minorAmount(', 'export async function recordBankConfirmation('));
 const staging=createValidator(extract(review,'function validateBankConfirmation(', '// REVIEW ONLY'));
 const cases=[
  valid,
  {...valid,amount:'10'},
  {...valid,amount:'10,00'},
  {...valid,amount:'10.01'},
  {...valid,amount:'0'},
  {...valid,amount:'1e1'},
  {...valid,confirmed:false},
  {...valid,currency:'USD'},
  {...valid,currency:'eur'},
  {...valid,invoiceReference:'wrong'},
  {...valid,bankReference:'bad'},
  {...valid,bankReference:'BANK-REVIEW-000001'},
  {...valid,valueDate:'2026-11-16'},
  {...valid,valueDate:'2026-02-30'},
  {...valid,valueDate:'bad-date'},
  {...valid,valueDate:'2026-11-15'}
 ];
 for(const claim of cases)
  assert.deepEqual(outcome(staging,invoice,claim),outcome(production,invoice,claim),
   'validator parity required for '+JSON.stringify(claim));
 assert.equal(outcome(staging,invoice,valid).ok,true);
 assert.equal(outcome(staging,invoice,{...valid,amount:'9.99'}).ok,false);
});
test('bank staging cannot activate accounts or mark payments paid',async()=>{
 const src=await read('lib/portal-bank-confirmation-staging-review.mjs');
 assert.doesNotMatch(src,/UPDATE\s+(?:public\.)?(?:clients|payments)/i);
 assert.doesNotMatch(src,/verifiedSettlement:\s*true|activated:\s*true/);
 assert.match(src,/withPilotWriteLockReview/);
});
