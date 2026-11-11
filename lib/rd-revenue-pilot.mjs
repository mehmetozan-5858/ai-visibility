import {reviewRevenueRecords} from './rd-revenue-review.mjs';
export function runRevenuePilot(){
 const payment={id:'synthetic-payment',clientId:'synthetic-tenant',status:'paid',expectedMinor:4900,currency:'TRY',accessActive:false};
 const proof={paymentId:payment.id,clientId:payment.clientId,transactionId:'txn_synthetic',eventId:'evt_synthetic',paidMinor:4900,currency:'TRY',independentlyConfirmed:true};
 const review=(p=payment,s=[proof])=>reviewRevenueRecords({clientId:payment.clientId,payments:[p],settlements:s}).findings[0];
 const cases=[
  ['consistent','Eşleşen kayıt gelir veya tahsilat başarısı sayılmaz',()=>{const r=reviewRevenueRecords({clientId:payment.clientId,payments:[payment],settlements:[proof]});return r.findings[0].state==='consistent-records'&&r.verifiedRevenue===null&&r.recoveredRevenue===null;}],
  ['missing-proof','İç ödeme etiketi bağımsız tahsilat kanıtı sayılmaz',()=>review(payment,[]).reasons.includes('missing-settlement-proof')],
  ['amount-mismatch','Tutar uyuşmazlığı incelemeye ayrılır',()=>review(payment,[{...proof,paidMinor:4800}]).reasons.includes('amount-mismatch')],
  ['currency-mismatch','Para birimi uyuşmazlığı incelemeye ayrılır',()=>review(payment,[{...proof,currency:'EUR'}]).reasons.includes('currency-mismatch')],
  ['refunded-access','İade kaydı varken açık erişim fark edilir',()=>review({...payment,status:'refunded',accessActive:true}).reasons.includes('refunded-access-active')],
  ['zero-test','Sıfır tutarlı test gelir sayılmaz',()=>review({...payment,expectedMinor:0},[]).state==='not-revenue'],
  ['unexpected-charge','Ücretsiz beklenen işlemde pozitif tahsilat fark edilir',()=>review({...payment,expectedMinor:0}).reasons.includes('unexpected-positive-charge')],
  ['unconfirmed','Doğrulanmamış sağlayıcı kaydı kabul edilmez',()=>review(payment,[{...proof,independentlyConfirmed:false}]).reasons.includes('missing-settlement-proof')],
  ['tenant-isolation','Başka müşterinin kaydı işleme alınmaz',()=>{try{review(payment,[{...proof,clientId:'different-tenant'}]);return false}catch{return true}}],
  ['reused-transaction','Aynı sağlayıcı kimliğiyle iki ödeme tutarlı sayılmaz',()=>{const other={...payment,id:'synthetic-payment-two'};const r=reviewRevenueRecords({clientId:payment.clientId,payments:[payment,other],settlements:[proof,{...proof,paymentId:other.id,eventId:'evt_second'}]});return r.findings.every(f=>f.reasons.includes('reused-provider-identity'));}]
 ];
 const results=cases.map(([id,name,run])=>{try{return {id,name,passed:run()===true}}catch{return {id,name,passed:false}}});
 return {module:'RD-04',phase:'synthetic-live-pilot',scope:'synthetic-only',ok:results.every(r=>r.passed),passed:results.filter(r=>r.passed).length,total:results.length,results,customerDataRead:false,externalActions:false,paymentChanges:false,paidProviderCalls:0,verifiedRevenue:null,recoveredRevenue:null};
}
