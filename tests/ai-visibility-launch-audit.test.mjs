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
