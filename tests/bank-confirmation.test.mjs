import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {readFile} from 'node:fs/promises';
const source=(await readFile(new URL('../lib/bank-confirmation.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'').replace(/export /g,'');
const {validateBankConfirmation,recordBankConfirmation}=new Function('crypto','initializeSchema',source+'\nreturn {validateBankConfirmation,recordBankConfirmation};')(crypto,async()=>{});
const invoice={id:'payment',clientId:'client',method:'bank-transfer',currency:'TRY',setupAmount:4990,monthlyAmount:0,referenceCode:'AIV-TEST',plan:'Diagnosis'};
const evidence={amount:'4990,00',currency:'TRY',invoiceReference:'AIV-TEST',bankReference:'BANK-12345',valueDate:'2026-10-05',confirmed:true};
const now=new Date('2026-10-06T12:00:00Z');
test('manual bank review preserves cents and uses Istanbul date',()=>{
 assert.equal(validateBankConfirmation(invoice,evidence,now).amountMinor,499000);
 assert.equal(validateBankConfirmation(invoice,{...evidence,amount:'4990.00'},now).amountMinor,499000);
 assert.equal(validateBankConfirmation(invoice,{...evidence,valueDate:'2026-10-07'},new Date('2026-10-06T22:00:00Z')).valueDate,'2026-10-07');
});
test('mismatched or incomplete bank evidence cannot confirm payment',()=>{
 for(const [patch,error] of [[{amount:'4.990,00'},'invalid-bank-amount'],[{amount:'4989'},'bank-amount-mismatch'],[{currency:'EUR'},'bank-currency-mismatch'],[{invoiceReference:'AIV-OTHER'},'bank-invoice-mismatch'],[{bankReference:'123'},'invalid-bank-reference'],[{confirmed:false},'bank-confirmation-required'],[{valueDate:'2026-02-30'},'invalid-bank-date'],[{valueDate:'2026-10-07'},'invalid-bank-date']])assert.throws(()=>validateBankConfirmation(invoice,{...evidence,...patch},now),new RegExp(error));
});
test('one bank transaction cannot fund another invoice',async()=>{
 const tx={query:async(sql)=>sql.startsWith('SELECT')?{rows:[{payment_id:'other-payment',amount_minor:499000}]}:{rows:[]}};
 await assert.rejects(recordBankConfirmation(tx,invoice,evidence),/bank-reference-already-used/);
});
test('bank audit explicitly identifies manual verification',async()=>{
 let metadata;
 const tx={query:async(sql,args)=>{if(sql.includes('INSERT INTO client_activity'))metadata=JSON.parse(args[2]);return {rows:[{id:'evidence'}]}}};
 await recordBankConfirmation(tx,invoice,evidence);
 assert.equal(metadata.automatic,false);assert.equal(metadata.verification,'manual-bank-review');assert.equal(metadata.amountMinor,499000);
});
const repository=await readFile(new URL('../lib/repository.js',import.meta.url),'utf8');
const confirmSource=repository.slice(repository.indexOf('export async function confirmPayment('),repository.indexOf('export async function upsertSalesOpportunity')).replace('export ','');
function fixture(auditFailure=false){
 const state={paid:false,active:false,committed:false,rolledBack:false};
 const tx={release(){},query:async(sql)=>{
  if(sql.includes('UPDATE payments')){state.paid=true;return {rows:[invoice]}}
  if(sql.includes('INSERT INTO bank_confirmations'))return {rows:[{id:'confirmation'}]};
  if(sql.includes('INSERT INTO client_activity')&&auditFailure)throw Error('audit-failed');
  if(sql.includes('UPDATE clients'))state.active=true;
  if(sql==='COMMIT')state.committed=true;
  if(sql==='ROLLBACK'){state.rolledBack=true;state.paid=false;state.active=false}
  return {rows:[]};
 }};
 const confirm=new Function('withDb','ensureBankConfirmation','recordBankConfirmation',confirmSource+'\nreturn confirmPayment;')(fn=>fn({connect:async()=>tx}),async()=>{},recordBankConfirmation);
 return {state,confirm};
}
test('incorrect bank amount rolls back payment and activation',async()=>{
 const {state,confirm}=fixture();await assert.rejects(confirm(invoice.id,{bankEvidence:{...evidence,amount:'1'}}),/bank-amount-mismatch/);assert.equal(state.paid,false);assert.equal(state.active,false);assert.equal(state.rolledBack,true);assert.equal(state.committed,false);
});
test('audit failure prevents activation; matching evidence commits together',async()=>{
 const failed=fixture(true);await assert.rejects(failed.confirm(invoice.id,{bankEvidence:evidence}),/audit-failed/);assert.equal(failed.state.paid,false);assert.equal(failed.state.active,false);
 const good=fixture();await good.confirm(invoice.id,{bankEvidence:evidence});assert.equal(good.state.paid,true);assert.equal(good.state.active,true);assert.equal(good.state.committed,true);
});
const routeSource=(await readFile(new URL('../app/api/admin-payments/route.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'').replace(/export /g,'');
test('admin API rejects old one-click approval without bank evidence',async()=>{
 let calls=0;
 const patch=new Function('requireAdmin','enforceSameOrigin','getPaymentById','confirmPayment','listPayments','reversePayment',routeSource+'\nreturn PATCH;')(async()=>null,()=>null,async()=>{calls++;return invoice},async()=>{calls++},async()=>[],async()=>{});
 const response=await patch(new Request('https://example.com/api/admin-payments',{method:'PATCH',body:JSON.stringify({id:'payment',bankVerified:true})}));
 assert.equal(response.status,400);assert.equal(calls,0);
});
