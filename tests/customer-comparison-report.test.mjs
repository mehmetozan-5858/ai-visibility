import test from 'node:test';import assert from 'node:assert/strict';
import {buildCustomerComparisonReport} from '../lib/customer-comparison-report.mjs';
test('customer-specific report does not fabricate scores',()=>{
 const report=buildCustomerComparisonReport({client:{id:'c1',name:'ZERA',country:'DE'},comparisons:[{clientId:'c1',query:'boutiques',results:[{provider:'gemini',verified:true,status:'source-supported-answer',evidence:{sourceUrl:'https://example.org'}}]}]});
 assert.equal(report.language,'en');assert.equal(report.visibilityScore,null);assert.equal(report.sourceSupportedResponses,1);
});
test('Turkish customer defaults to Turkish and isolated customer ID required',()=>{
 assert.equal(buildCustomerComparisonReport({client:{id:'c1',name:'Örnek',country:'TR'},comparisons:[]}).language,'tr');
 assert.throws(()=>buildCustomerComparisonReport({client:{id:'c1',name:'Örnek'},comparisons:[{clientId:'c2',query:'x',results:[]}]}),/Cross-customer/);
});
