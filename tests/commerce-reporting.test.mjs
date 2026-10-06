import test from 'node:test';
import assert from 'node:assert/strict';
import {shopierProduct,paymentMatchesPlan} from '../lib/hosted-checkout.js';
import {servicePrice} from '../lib/regional-pricing.js';
import {reportDay,reportMarkets} from '../lib/reporting.js';
import {wordpressTarget,draftContent} from '../lib/wordpress-validation.js';
test('Istanbul midnight and parallel markets are represented correctly',()=>{
 assert.equal(reportDay('2026-10-06T21:01:00Z'),'2026-10-07');
 assert.equal(reportDay('2026-10-06T20:59:00Z'),'2026-10-06');
 assert.equal(reportDay('invalid'),'');
 assert.deepEqual(reportMarkets([{market:{mode:'parallel',markets:[{country:'Germany',city:'Berlin'}]}},{market:{country:'Germany',city:'Berlin'}}]),[{country:'Germany',city:'Berlin'}]);
});
test('hosted checkout binds product to exact service, amount and currency',()=>{
 const plan=servicePrice({service:'business-diagnosis',country:'Germany'});
 const config=item=>JSON.stringify({[`${plan.code}:${plan.currency}`]:{url:'https://www.shopier.com/example',amount:plan.firstPayment,currency:plan.currency,...item}});
 assert.ok(shopierProduct(plan,config({})));
 for(const changes of [{amount:1},{currency:'TRY'},{url:'https://shopier.com.evil.test/pay'},{url:'http://shopier.com/pay'},{url:'https://user:pass@shopier.com/pay'}])assert.equal(shopierProduct(plan,config(changes)),null);
 assert.equal(paymentMatchesPlan({plan:plan.name,currency:plan.currency,setupAmount:plan.setupAmount,monthlyAmount:0},plan),true);
 assert.equal(paymentMatchesPlan({plan:'Other',currency:plan.currency,setupAmount:plan.setupAmount,monthlyAmount:0},plan),false);
});
test('single-payment and recurring invoices retain distinct amounts',()=>{
 const one=servicePrice({service:'business-diagnosis',country:'Türkiye'}),monthly=servicePrice({service:'business-monitoring',country:'Türkiye'});
 assert.ok(one.setupAmount>0);assert.equal(one.monthlyAmount,0);assert.equal(monthly.setupAmount,0);assert.ok(monthly.monthlyAmount>0);
});
test('WordPress draft requires the client site and never emits executable HTML',()=>{
 assert.equal(wordpressTarget('https://www.example.com','example.com'),'https://www.example.com');
 for(const [site,domain] of [['https://other.com','example.com'],['http://example.com','example.com'],['https://127.0.0.1','127.0.0.1'],['https://user:pass@example.com','example.com']])assert.throws(()=>wordpressTarget(site,domain));
 const draft=draftContent('Title','<script>alert(1)</script>');assert.equal(draft.status,'draft');assert.ok(!draft.content.includes('<script>'));assert.throws(()=>draftContent('',''));
});
