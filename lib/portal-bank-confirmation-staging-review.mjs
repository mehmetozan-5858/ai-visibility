import {randomUUID} from 'node:crypto';
import {withPilotWriteLockReview} from './portal-pilot-advisory-lock-review.mjs';
// Self-contained review validator: the production bank-confirmation.js imports
// a bundler-only extensionless database module, so Node's native CI loader
// cannot import it directly. Production bank verification is unchanged.
// This duplicated bounded validation remains a parity/acceptance HOLD.
function validateBankConfirmation(invoice,input={},now=new Date()){
 if(input.confirmed!==true||invoice.method!=='bank-transfer')throw Error('bank-confirmation-required');
 const raw=String(input.amount??'').trim();
 if(!/^\d{1,10}([.,]\d{1,2})?$/.test(raw))throw Error('invalid-bank-amount');
 const [whole,fraction='']=raw.replace(',','.').split('.');
 const amountMinor=Number(whole)*100+Number(fraction.padEnd(2,'0'));
 if(!Number.isSafeInteger(amountMinor)||amountMinor<=0)throw Error('invalid-bank-amount');
 const currency=String(input.currency||'').trim().toUpperCase();
 const invoiceReference=String(input.invoiceReference||'').trim().toUpperCase();
 const bankReference=String(input.bankReference||'').trim().toUpperCase();
 if(!['TRY','USD','EUR','GBP'].includes(currency)||currency!==invoice.currency)
  throw Error('bank-currency-mismatch');
 if(amountMinor!==Math.round((Number(invoice.setupAmount)+Number(invoice.monthlyAmount))*100))
  throw Error('bank-amount-mismatch');
 if(!invoiceReference||invoiceReference!==invoice.referenceCode)
  throw Error('bank-invoice-mismatch');
 if(!/^[A-Z0-9][A-Z0-9./_-]{5,119}$/.test(bankReference))
  throw Error('invalid-bank-reference');
 const valueDate=String(input.valueDate||'');
 const parsed=new Date(valueDate+'T00:00:00Z');
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',
  year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(valueDate)||!Number.isFinite(parsed.getTime())||
  parsed.toISOString().slice(0,10)!==valueDate||valueDate>today)
  throw Error('invalid-bank-date');
 return {amountMinor,currency,invoiceReference,bankReference,valueDate};
}

// REVIEW ONLY — intentionally NOT connected to production payment routes.
// Stage a manually reviewed bank-reference record under the same tenant lock
// used by pilot grants/revokes. Recording is NOT independent bank settlement:
// it MUST NOT set payments.status='paid' or clients.status='active'.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function stageBankConfirmationLockedReview(pool,paymentId,input){
 if(!pool||typeof pool.query!=='function'||!UUID.test(String(paymentId)))
  throw Error('review-bank-staging-invalid');
 // Resolve only the tenant before locking; all monetary and status assertions
 // are repeated on a fresh statement after the transaction lock is acquired.
 const matches=(await pool.query(
  'SELECT client_id AS "clientId" FROM public.payments WHERE id=$1 LIMIT 2',
  [paymentId])).rows;
 if(!Array.isArray(matches)||matches.length!==1||!UUID.test(String(matches[0].clientId)))
  throw Error('review-bank-staging-payment-unresolved');
 return withPilotWriteLockReview(pool,matches[0].clientId,async(tx,tenant)=>{
  const rows=(await tx.query(`SELECT id,client_id AS "clientId",
   reference_code AS "referenceCode", method,status,currency,
   setup_amount AS "setupAmount",monthly_amount AS "monthlyAmount"
   FROM public.payments WHERE id=$1 AND client_id=$2 FOR UPDATE`,
   [paymentId,tenant])).rows;
  if(!Array.isArray(rows)||rows.length!==1||
   rows[0].clientId!==tenant||rows[0].method!=='bank-transfer'||
   rows[0].status!=='customer-reported')
   throw Error('review-bank-staging-payment-ineligible');
  // The confirmed boolean represents a manually entered claim, NOT a bank API
  // verification or proof of settlement. Fail closed if its details mismatch.
  const evidence=validateBankConfirmation(rows[0],input);
  const existing=(await tx.query(`SELECT payment_id AS "paymentId",amount_minor AS "amountMinor",
    value_date::text AS "valueDate",invoice_reference AS "invoiceReference"
    FROM public.bank_confirmations WHERE currency=$1 AND bank_reference=$2`,
    [evidence.currency,evidence.bankReference])).rows;
  if(existing.length>1||existing.length===1&&
    (existing[0].paymentId!==paymentId||
     Number(existing[0].amountMinor)!==evidence.amountMinor||
     existing[0].valueDate!==evidence.valueDate||
     existing[0].invoiceReference!==evidence.invoiceReference))
   throw Error('review-bank-staging-reference-conflict');
  if(existing.length===0){
   const recorded=await tx.query(`INSERT INTO public.bank_confirmations
    (id,payment_id,currency,bank_reference,amount_minor,value_date,invoice_reference)
    VALUES($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT(currency,bank_reference) DO NOTHING RETURNING id`,
    [randomUUID(),paymentId,evidence.currency,evidence.bankReference,
     evidence.amountMinor,evidence.valueDate,evidence.invoiceReference]);
   if(recorded.rows?.length!==1)
    throw Error('review-bank-staging-concurrent-reference');
  }
  return {staged:true,alreadyStaged:existing.length===1,
    verifiedSettlement:false,activated:false};
 });
}
