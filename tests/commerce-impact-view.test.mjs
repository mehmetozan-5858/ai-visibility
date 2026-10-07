import test from 'node:test';
import assert from 'node:assert/strict';
import {metricNumber,businessMetricSummary,commerceSignalSummary,commerceFields,readCommerceClient} from '../lib/commerce-impact-view.js';
test('missing business metrics cannot create zero revenue or conversion',()=>{
 for(const x of [null,undefined,'',' ',false,[],{},NaN,-1])assert.equal(metricNumber(x),null);
 const empty=businessMetricSummary({monthlyTraffic:100,evidence:'CRM',currency:'TRY'});assert.equal(empty.conversionRate,null);assert.equal(empty.derivedRevenue,null);assert.equal(empty.recordedRevenue,null);
 const m={monthlyTraffic:100,monthlyConversions:0,averageValue:20,monthlyRevenue:0,currency:'TRY',evidence:'CRM'};
 assert.equal(businessMetricSummary(m).recordedRevenue,0);assert.equal(businessMetricSummary(m).conversionRate,0);
 assert.equal(businessMetricSummary({...m,evidence:''}).derivedRevenue,null);
 assert.equal(businessMetricSummary({...m,currency:'invalid'}).recordedRevenue,null);
 assert.equal(businessMetricSummary({...m,monthlyConversions:101}).conversionRate,null);
 assert.equal(businessMetricSummary({...m,monthlyConversions:1e300,averageValue:1e300}).derivedRevenue,null);
});
test('commerce score needs all four source notes and cannot infer readiness from no findings',()=>{
 assert.equal(commerceSignalSummary({}).score,null);
 const s=Object.fromEntries(commerceFields.flatMap(([k,e])=>[[k,'verified'],[e,'official source']]));
 assert.equal(commerceSignalSummary(s).score,100);assert.equal(commerceSignalSummary({...s,catalogEvidence:''}).score,null);
 assert.equal(commerceSignalSummary({...s,catalogStatus:'partial'}).score,88);
});
test('commerce client read keeps matching sources together and fails on partial or mismatched data',async()=>{
 const signal=new AbortController().signal;
 const f=async(p,o)=>{assert.equal(o.signal,signal);assert.equal(o.cache,'no-store');return {ok:true,json:async()=>p.startsWith('/api/business')?{metrics:{clientId:'a'}}:{signals:{clientId:'a'}}}};
 assert.equal((await readCommerceClient(f,'a',signal)).metrics.clientId,'a');
 await assert.rejects(readCommerceClient(async()=>({ok:false,status:401}),'a'));
 await assert.rejects(readCommerceClient(async()=>({ok:true,json:async()=>({signals:{clientId:'b'},metrics:{clientId:'b'}})}),'a'));
});
