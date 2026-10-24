import test from 'node:test';
import assert from 'node:assert/strict';
import {createPilot,canRun,assertPublicScope,classifyEvidence,campaignLink,summarizeFunnel,enqueueOutreach} from '../pilot/zera-pilot.mjs';
test('public consent is scoped and no active sends or costs',()=>{
 const p=createPilot(); assert.equal(p.id,'ZERA-DE-001');
 assert.equal(canRun(p,'public_brand_audit'),true);
 assert.equal(canRun(p,'private_instagram_analytics'),false);
 assert.throws(()=>assertPublicScope(p,'private_instagram_analytics'));
 assert.equal(p.outboundEnabled,false);assert.equal(p.paidServicesEnabled,false);
});
test('observed facts require dated source',()=> {
 assert.throws(()=>classifyEvidence({type:'observed',observation:'Mentioned'}));
 assert.equal(classifyEvidence({type:'hypothesis',observation:'May be unclear'}).type,'hypothesis');
});
test('tagged links use https and deterministic campaign fields',()=>{
 const link=campaignLink('https://example.com/zera',{source:'google'});
 assert.equal(new URL(link).searchParams.get('utm_source'),'google');
 assert.throws(()=>campaignLink('http://example.com',{source:'google'}));
});
test('only verified, unique, consent-attributed orders count as sales',()=>{
 assert.deepEqual(summarizeFunnel({visits:100,leads:10}).verifiedSales,0);
 assert.throws(()=>summarizeFunnel({verifiedOrders:[{id:'1',amount:20,merchantVerified:false,consentedAttribution:true}]}));
 const result=summarizeFunnel({visits:100,leads:10,verifiedOrders:[{id:'1',amount:20,merchantVerified:true,consentedAttribution:true}]});
 assert.equal(result.verifiedRevenue,20); assert.equal(result.verifiedSales,1);
});
test('outreach never automatically dispatches',()=>{
 const draft={recipient:'info@ze-ra.de',subject:'Pilot',body:'Hello'};
 assert.deepEqual(enqueueOutreach({draft,approvedBy:null,senderConfigured:true,consentToContact:true}),{status:'awaiting_approval',sent:false});
 assert.equal(enqueueOutreach({draft,approvedBy:'owner',senderConfigured:true,consentToContact:true}).sent,false);
});
