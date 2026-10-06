import crypto from 'node:crypto';
import {initializeSchema} from './database-runtime';
export async function ensureBankConfirmation(pool){
 await initializeSchema(pool,'manual-bank-confirmations-v1',tx=>tx.query(`CREATE TABLE IF NOT EXISTS bank_confirmations(
  id UUID PRIMARY KEY,payment_id UUID NOT NULL REFERENCES payments(id),currency TEXT NOT NULL,
  bank_reference TEXT NOT NULL,amount_minor BIGINT NOT NULL,value_date DATE NOT NULL,
  invoice_reference TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(currency,bank_reference)
 )`));
}
function minorAmount(raw){
 const value=String(raw??'').trim();if(!/^\d{1,10}([.,]\d{1,2})?$/.test(value))throw Error('invalid-bank-amount');
 const [whole,fraction='']=value.replace(',','.').split('.');const minor=Number(whole)*100+Number(fraction.padEnd(2,'0'));
 if(!Number.isSafeInteger(minor)||minor<=0)throw Error('invalid-bank-amount');return minor;
}
export function validateBankConfirmation(invoice,input={},now=new Date()){
 if(input.confirmed!==true||invoice.method!=='bank-transfer')throw Error('bank-confirmation-required');
 const amountMinor=minorAmount(input.amount),currency=String(input.currency||'').trim().toUpperCase();
 const reference=String(input.invoiceReference||'').trim().toUpperCase(),bankReference=String(input.bankReference||'').trim().toUpperCase();
 if(!['TRY','USD','EUR','GBP'].includes(currency)||currency!==invoice.currency)throw Error('bank-currency-mismatch');
 if(amountMinor!==Math.round((Number(invoice.setupAmount)+Number(invoice.monthlyAmount))*100))throw Error('bank-amount-mismatch');
 if(!reference||reference!==invoice.referenceCode)throw Error('bank-invoice-mismatch');
 if(!/^[A-Z0-9][A-Z0-9./_-]{5,119}$/.test(bankReference))throw Error('invalid-bank-reference');
 const date=String(input.valueDate||'');const parsed=new Date(date+'T00:00:00Z');
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==date||date>today)throw Error('invalid-bank-date');
 return {amountMinor,currency,invoiceReference:reference,bankReference,valueDate:date};
}
export async function recordBankConfirmation(tx,invoice,input){
 const evidence=validateBankConfirmation(invoice,input);
 const inserted=(await tx.query(`INSERT INTO bank_confirmations(id,payment_id,currency,bank_reference,amount_minor,value_date,invoice_reference)
 VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(currency,bank_reference) DO NOTHING RETURNING id`,[crypto.randomUUID(),invoice.id,evidence.currency,evidence.bankReference,evidence.amountMinor,evidence.valueDate,evidence.invoiceReference])).rows[0];
 if(!inserted){const existing=(await tx.query('SELECT payment_id,amount_minor FROM bank_confirmations WHERE currency=$1 AND bank_reference=$2',[evidence.currency,evidence.bankReference])).rows[0];if(!existing||existing.payment_id!==invoice.id||Number(existing.amount_minor)!==evidence.amountMinor)throw Error('bank-reference-already-used')}
 await tx.query(`INSERT INTO client_activity(id,client_id,event_type,title,detail,metadata) VALUES($1,$2,'payment','Banka kontrolü kaydedildi','Tutar, para birimi ve işlem referansı yönetici tarafından banka kaydıyla karşılaştırıldı.',$3::jsonb)`,[crypto.randomUUID(),invoice.clientId,JSON.stringify({paymentId:invoice.id,...evidence,verification:'manual-bank-review',automatic:false})]);
 return evidence;
}
