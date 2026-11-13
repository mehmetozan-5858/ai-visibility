import test from 'node:test';
import assert from 'node:assert/strict';
import {eligibleFreeApplicantEvidence} from '../lib/free-applicant-proof-policy.mjs';

test('legacy cost_ledger shape is insufficient even when amount is zero',()=>{
 const observation={tenantId:'tenant-1',domain:'example.test',provider:'OpenRouter',
  model:'google/gemma-4-31b-it:free',responseId:'response-1',
  query:'What clothing businesses serve this area?',text:'Synthetic response',
  brandPrompted:false,truncated:false,brandMentioned:false};
 // This reflects the persisted fields returned by recordOperationalCost,
 // not a fabricated full per-response proof record.
 const legacyReceipt={id:'cost-entry-1',costType:'ai-provider',provider:'OpenRouter',
  operation:'answer-evidence',marketKey:'business:ai',amount:0,currency:'USD',
  estimated:false,createdAt:'2026-11-12T20:00:00Z'};
 assert.equal(eligibleFreeApplicantEvidence(observation,legacyReceipt,{
  tenantId:'tenant-1',domain:'example.test'}),false);
});
test('adding only a response ID to a legacy receipt is still not enough',()=>{
 const observation={tenantId:'tenant-1',domain:'example.test',provider:'Gemini',
  model:'gemini-3.5-flash-lite',responseId:'response-1',
  query:'What clothing businesses serve this area?',text:'Synthetic response',
  brandPrompted:false,truncated:false,brandMentioned:false};
 const receipt={id:'cost-entry-1',provider:'Gemini',responseId:'response-1',
  amount:0,currency:'USD',estimated:false,operation:'answer-evidence',
  // deliberately missing durable tenant/model/query/provenance evidence
  metadata:{pricingSource:'provider-reported-zero'}};
 assert.equal(eligibleFreeApplicantEvidence(observation,receipt,{
  tenantId:'tenant-1',domain:'example.test'}),false);
});
