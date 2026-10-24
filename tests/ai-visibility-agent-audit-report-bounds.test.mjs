import test from "node:test";
import assert from "node:assert/strict";
import {buildAgentAuditClientReport as report} from "../lib/ai-visibility-agent-audit-report.mjs";
const id="550e8400-e29b-41d4-a716-446655440000";
const record={clientId:id,id:"agent_0",runs:10,failures:1,humanHandoffs:0,estimatedCostCents:20};
const base={authorizedClientId:id,generatedAt:"2026-10-24T12:00:00Z"};
test("rejects over-limit metrics before reading any records",()=>{
 const oversized=Array(101);
 Object.defineProperty(oversized,0,{get(){throw Error("record must not be read")},configurable:true});
 assert.deepEqual(report({...base,records:oversized}),{ok:false,reason:"invalid-records"});
});
test("accepts exactly 100 distinct agent metrics",()=>{
 const records=Array.from({length:100},(_,i)=>({...record,id:`agent_${i}`}));
 const r=report({...base,records});
 assert.equal(r.ok,true);
 assert.equal(r.summary.agentCount,100);
});
test("rejects malformed tenant identifiers, including near-UUID strings",()=>{
 for(const invalid of [
  "550e8400-e29b-41d4-a716-446655440000-extra",
  "550e8400-e29b-41d4-a716-44665544000",
  "550e8400-e29b-01d4-a716-446655440000",
  "550e8400-e29b-41d4-1716-446655440000"
 ]){
  const r=report({...base,authorizedClientId:invalid,records:[record]});
  assert.deepEqual(r,{ok:false,reason:"invalid-client"});
 }
});
test("cross-tenant record is still denied",()=>{
 const r=report({...base,records:[{...record,clientId:"550e8400-e29b-41d4-a716-446655440001"}]});
 assert.equal(r.ok,false);
 assert.equal(r.reason,"cross-tenant-record");
});
