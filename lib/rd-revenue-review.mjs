/** Pure record-consistency review. Inputs must eventually come from trusted,
 * tenant-scoped storage, never caller assertions of signature verification.
 * This function neither verifies provider signatures nor establishes revenue.
 */
const id=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(v);
const currency=v=>typeof v==='string'&&/^[A-Z]{3}$/.test(v);
export function reviewRevenueRecords({clientId,payments=[],settlements=[]}={}){
 if(!id(clientId)||!Array.isArray(payments)||!Array.isArray(settlements)||payments.length>200||settlements.length>400)throw Error('invalid-review-input');
 if([...payments,...settlements].some(r=>!r||r.clientId!==clientId))throw Error('tenant-scope-mismatch');
 if(payments.some(p=>!id(p.id))||new Set(payments.map(p=>p.id)).size!==payments.length)throw Error('ambiguous-payment-identity');
 const findings=payments.map(payment=>{
  const reasons=[];
  if(!Number.isSafeInteger(payment.expectedMinor)||payment.expectedMinor<0||!currency(payment.currency)||!['pending','failed','paid','refunded'].includes(payment.status))return {paymentId:payment.id,state:'unknown',reasons:['invalid-payment-record']};
  if(payment.expectedMinor===0){
   const charged=settlements.some(s=>s.paymentId===payment.id&&s.independentlyConfirmed===true&&Number.isSafeInteger(s.paidMinor)&&s.paidMinor>0);
   return {paymentId:payment.id,state:charged?'review':'not-revenue',reasons:[charged?'unexpected-positive-charge':'zero-amount-test']};
  }
  if(payment.status==='refunded')return {paymentId:payment.id,state:payment.accessActive===true?'review':'not-revenue',reasons:[payment.accessActive===true?'refunded-access-active':'refunded-payment']};
  if(payment.status!=='paid')return {paymentId:payment.id,state:'pending',reasons:['no-settlement-claimed']};
  const proofs=settlements.filter(s=>s.paymentId===payment.id&&s.independentlyConfirmed===true);
  if(proofs.length!==1)return {paymentId:payment.id,state:'review',reasons:[proofs.length?'ambiguous-settlement-proof':'missing-settlement-proof']};
  const proof=proofs[0];
  if(!/^txn_[a-z0-9]+$/i.test(proof.transactionId||'')||!/^evt_[a-z0-9]+$/i.test(proof.eventId||'')||!Number.isSafeInteger(proof.paidMinor)||proof.paidMinor<=0||!currency(proof.currency))return {paymentId:payment.id,state:'unknown',reasons:['invalid-settlement-record']};
  if(settlements.some(s=>s!==proof&&s.independentlyConfirmed===true&&(s.transactionId===proof.transactionId||s.eventId===proof.eventId)))reasons.push('reused-provider-identity');
  if(proof.currency!==payment.currency)reasons.push('currency-mismatch');
  if(proof.paidMinor!==payment.expectedMinor)reasons.push('amount-mismatch');
  return {paymentId:payment.id,state:reasons.length?'review':'consistent-records',reasons};
 });
 return {findings,reviewCount:findings.filter(f=>f.state==='review').length,
  unknownCount:findings.filter(f=>f.state==='unknown').length,
  verifiedRevenue:null,recoveredRevenue:null,externalActions:false,paymentChanges:false};
}
