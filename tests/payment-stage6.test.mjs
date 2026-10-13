import test from "node:test";
import assert from "node:assert/strict";
import {exactPaytrAmountMatches} from "../lib/payment-stage6.js";
import {shopierProduct,paymentMatchesPlan} from "../lib/hosted-checkout.js";
import {validIban,bankTransfer} from "../lib/bank-transfer.js";

const invoice={currency:"TRY",setupAmount:4990,monthlyAmount:0};
test("PayTR callback only accepts the exact original amount in minor units",()=>{
 assert.equal(exactPaytrAmountMatches(invoice,"499000"),true);
 for(const amount of ["498999","499001","4990","0","-499000","499000.0","499000x","999999999999999999999"])assert.equal(exactPaytrAmountMatches(invoice,amount),false,amount);
 assert.equal(exactPaytrAmountMatches({...invoice,currency:"EUR"},"499000"),false);
 assert.equal(exactPaytrAmountMatches({...invoice,setupAmount:0},"0"),false);
});
test("Hosted checkout rejects tampered currency, amount and domains",()=>{
 const plan={code:"business-diagnosis",currency:"TRY",firstPayment:4990};
 const item=(url,currency="TRY",amount=4990)=>JSON.stringify({"business-diagnosis:TRY":{url,currency,amount}});
 assert.equal(shopierProduct(plan,item("https://www.shopier.com/example"))?.amount,4990);
 assert.equal(shopierProduct(plan,item("https://evil.example/")),null);
 assert.equal(shopierProduct(plan,item("https://shopier.com.evil.example/")),null);
 assert.equal(shopierProduct(plan,item("https://www.shopier.com/example","EUR")),null);
 assert.equal(shopierProduct(plan,item("https://www.shopier.com/example","TRY",1)),null);
});
test("Payment service price and currency must match",()=>{
 const plan={name:"İşletme",currency:"TRY",setupAmount:4990,monthlyAmount:0};
 assert.equal(paymentMatchesPlan({plan:"İşletme",currency:"TRY",setupAmount:4990,monthlyAmount:0},plan),true);
 assert.equal(paymentMatchesPlan({plan:"İşletme",currency:"TRY",setupAmount:1,monthlyAmount:0},plan),false);
 assert.equal(paymentMatchesPlan({plan:"İşletme",currency:"EUR",setupAmount:4990,monthlyAmount:0},plan),false);
});
test("Bank transfer is fail closed without valid account configuration",()=>{
 assert.equal(bankTransfer("TRY",{}),null);
 assert.equal(bankTransfer("USD",{PAYMENT_BANK_NAME:"Bank",PAYMENT_ACCOUNT_HOLDER:"Test",PAYMENT_IBAN_USD:"INVALID",PAYMENT_BANK_SWIFT:"ABCDEF12"}),null);
 assert.equal(validIban("TR000000000000000000000000"),false);
});
