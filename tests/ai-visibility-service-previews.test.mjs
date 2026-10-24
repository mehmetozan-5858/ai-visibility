import test from "node:test";
import assert from "node:assert/strict";
import {prepareLaunchServicePreview as run} from "../lib/ai-visibility-service-previews.mjs";
const ids=["agent-audit-control","agent-commerce-intelligence","candidate-rediscovery","voice-revenue-agent"];
for(const serviceId of ids)test(`${serviceId} supports safe preview`,()=>{
 const r=run({serviceId,tenantId:"t1",records:[{tenantId:"t1"}],consentVerified:true});
 assert.equal(r.ok,true);assert.equal(r.externalActionsEnabled,false);assert.equal(r.requiresHumanReview,true);
});
test("reject cross-tenant records",()=>assert.equal(run({serviceId:ids[0],tenantId:"t1",records:[{tenantId:"t2"}]}).reason,"invalid-or-cross-tenant-records"));
test("sensitive workflows require verified consent",()=>{
 for(const serviceId of ids.slice(2))assert.equal(run({serviceId,tenantId:"t1"}).reason,"consent-required");
});
test("invalid services and oversized inputs fail closed",()=>{
 assert.equal(run({serviceId:"not-a-service",tenantId:"t1"}).reason,"unknown-service");
 assert.equal(run({serviceId:ids[0],tenantId:"t1",records:Array(101).fill({tenantId:"t1"})}).ok,false);
});
