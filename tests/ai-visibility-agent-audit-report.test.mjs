import test from "node:test";
import assert from "node:assert/strict";
import {buildAgentAuditClientReport as report} from "../lib/ai-visibility-agent-audit-report.mjs";
const id="550e8400-e29b-41d4-a716-446655440000";
const record={clientId:id,id:"agent_1",runs:20,failures:3,humanHandoffs:2,estimatedCostCents:100,prompt:"SECRET",apiKey:"KEY"};
const base={authorizedClientId:id,records:[record],generatedAt:"2026-10-24T12:00:00Z"};
test("produces tenant-bound sanitized report",()=>{
 const r=report(base);assert.equal(r.ok,true);assert.equal(r.clientId,id);
 assert.equal(r.agents[0].failureRatePercent,15);
 assert.equal(JSON.stringify(r).includes("SECRET"),false);
 assert.equal(JSON.stringify(r).includes("KEY"),false);
});
test("rejects cross-tenant records rather than filtering",()=>{
 assert.equal(report({...base,records:[record,{...record,clientId:"other"}]}).reason,"cross-tenant-record");
});
test("rejects missing tenant and invalid timestamps",()=>{
 assert.equal(report({...base,authorizedClientId:"demo-1"}).ok,false);
 assert.equal(report({...base,generatedAt:"not-a-date"}).ok,false);
});
test("does not mutate source records",()=>{
 const before=JSON.stringify(record);report(base);assert.equal(JSON.stringify(record),before);
});
