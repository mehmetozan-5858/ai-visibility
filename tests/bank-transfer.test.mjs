import test from 'node:test';
import assert from 'node:assert/strict';
import {bankTransfer,validIban} from '../lib/bank-transfer.js';
const bban='00010'+'0'.repeat(16)+'1';
const checksum=98n-BigInt(bban+'292700')%97n;
const iban='TR'+String(checksum).padStart(2,'0')+bban;
const env={PAYMENT_BANK_NAME:'Test Bank',PAYMENT_ACCOUNT_HOLDER:'Test Holder',PAYMENT_IBAN:iban,PAYMENT_IBAN_EUR:iban,PAYMENT_BANK_SWIFT:'TCZBTR2AXXX'};
test('currency rail requires its own configured IBAN and BIC',()=>{
 assert.equal(bankTransfer('TRY',env).currency,'TRY');
 assert.equal(bankTransfer('EUR',env).swift,'TCZBTR2AXXX');
 assert.equal(bankTransfer('USD',env),null);
 assert.equal(bankTransfer('GBP',env),null);
 assert.equal(bankTransfer('JPY',env),null);
 assert.equal(bankTransfer('EUR',{...env,PAYMENT_BANK_SWIFT:''}),null);
});
test('invalid IBAN fails closed, whitespace normalizes, no foreign fallback to TL',()=>{
 assert.ok(validIban(iban));
 assert.ok(validIban(iban.slice(0,4)+' '+iban.slice(4)));
 assert.equal(validIban(iban.slice(0,-1)+'2'),false);
 assert.equal(bankTransfer('EUR',{...env,PAYMENT_IBAN_EUR:''}),null);
 assert.equal(bankTransfer('TRY',{...env,PAYMENT_IBAN:'TR00'}),null);
});
