import test from "node:test";
import assert from "node:assert/strict";
import {prepareLaunchAuditEvent} from "../lib/ai-visibility-launch-audit.mjs";
const valid={tenantId:"customer_1",actorId:"agent_1",serviceId:"agent-audit-control",eventType:"agent-plan-prepared"};
test("valid audit envelope is only prepared, never persisted",()=>{
 const r=prepareLaunchAuditEvent(valid);
 assert.equal(r.ok,true);assert.equal(r.event.state,"prepared-not-persisted");assert.equal(r.event.tenantId,"customer_1");
 assert.match(r.event.id,/^[0-9a-f-]{36}$/);
});
test("missing tenant or actor fails closed",()=>{
 assert.equal(prepareLaunchAuditEvent({...valid,tenantId:""}).reason,"invalid-scope");
 assert.equal(prepareLaunchAuditEvent({...valid,actorId:null}).reason,"invalid-scope");
});
test("untrusted event types rejected",()=>{
 assert.equal(prepareLaunchAuditEvent({...valid,eventType:"payment-sent"}).reason,"invalid-event-type");
});
test("noncanonical time and sensitive free text are not accepted",()=>{
 assert.equal(prepareLaunchAuditEvent({...valid,occurredAt:"yesterday"}).reason,"invalid-timestamp");
 assert.equal(prepareLaunchAuditEvent({...valid,sourceId:"private candidate resume contents"}).reason,"invalid-source");
});
test("success events require a known launch service across all four catalog entries",()=>{
 for (const serviceId of ["agent-audit-control","agent-commerce-intelligence","candidate-rediscovery","voice-revenue-agent"]) {
  assert.equal(prepareLaunchAuditEvent({...valid,serviceId,eventType:"authorization-allowed"}).ok,true);
 }
 for (const eventType of ["authorization-allowed","report-prepared","agent-plan-prepared","approval-requested"]) {
  assert.deepEqual(prepareLaunchAuditEvent({...valid,serviceId:"unknown-service",eventType}),{ok:false,reason:"unknown-service"});
 }
});
test("denials and errors can audit attempts against unknown but syntactically safe services",()=>{
 for (const eventType of ["authorization-denied","service-error"]) {
  const result=prepareLaunchAuditEvent({...valid,serviceId:"unknown-service",eventType});
  assert.equal(result.ok,true);
  assert.equal(result.event.state,"prepared-not-persisted");
 }
});
