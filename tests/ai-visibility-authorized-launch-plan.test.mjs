import test from "node:test";
import assert from "node:assert/strict";
import {prepareAuthorizedLaunchServicePlan as plan} from "../lib/ai-visibility-authorized-launch-plan.mjs";

const now=Date.parse("2026-10-25T00:00:00.000Z");
const catalog=[
 ["agent-audit-control","agent-run-review",false],
 ["agent-commerce-intelligence","catalog-readiness",false],
 ["candidate-rediscovery","candidate-match-preview",true],
 ["voice-revenue-agent","appointment-draft",true],
];
const request=(serviceId,capability,extra={})=>({
 sessionClientId:"client_1",accountClientId:"client_1",serviceId,capability,
 globallyEnabled:true,featureEnabled:true,now,
 actor:{id:"user_1",authenticated:true},
 membership:{actorId:"user_1",tenantId:"client_1",role:"owner",verified:true},
 entitlement:{source:"server",clientId:"client_1",serviceId,status:"active",
  expiresAt:"2026-10-26T00:00:00.000Z",consentVerified:true},...extra
});

test("all four services can only prepare a non-executing plan with trusted entitlement",()=>{
 for(const [id,capability] of catalog){
  const r=plan(request(id,capability));
  assert.equal(r.ok,true,id);assert.equal(r.state,"prepared-not-running");
  assert.equal(r.tenantId,"client_1");assert.equal(r.executes,false);
  assert.equal(r.entitlementChecked,true);assert.equal(r.externalActionsEnabled,false);
  assert.equal(r.auditPersisted,false);assert.equal(r.requiresAuditPersistence,true);
  assert.equal(r.requiresProductionApproval,true);
  assert.equal(r.auditEvent.state,"prepared-not-persisted");
 }
});
test("all four services fail closed when the feature flag is disabled",()=>{
 for(const [id,capability] of catalog)
  assert.equal(plan(request(id,capability,{globallyEnabled:false})).reason,"service-disabled");
});
test("all four services reject cross-tenant and wrong-service entitlements",()=>{
 for(const [id,capability] of catalog){
  const base=request(id,capability);
  assert.equal(plan({...base,accountClientId:"client_2"}).reason,"cross-tenant-denied");
  assert.equal(plan({...base,entitlement:{...base.entitlement,clientId:"client_2"}}).reason,"service-entitlement-required");
  assert.equal(plan({...base,entitlement:{...base.entitlement,serviceId:"another-service"}}).reason,"service-entitlement-required");
 }
});
test("expired and revoked entitlements cannot prepare plans",()=>{
 for(const [id,capability] of catalog){
  const base=request(id,capability);
  assert.equal(plan({...base,entitlement:{...base.entitlement,expiresAt:"2026-10-25T00:00:00.000Z"}}).reason,"entitlement-expired-or-unverifiable");
  assert.equal(plan({...base,entitlement:{...base.entitlement,revoked:true}}).reason,"service-entitlement-required");
 }
});
test("sensitive services require verified non-revoked consent",()=>{
 for(const [id,capability,sensitive] of catalog.filter(x=>x[2])){
  const base=request(id,capability);
  assert.equal(plan({...base,entitlement:{...base.entitlement,consentVerified:false}}).reason,"verified-consent-required");
  assert.equal(plan({...base,entitlement:{...base.entitlement,consentRevoked:true}}).reason,"verified-consent-required");
 }
});
test("unsupported capabilities never produce plans",()=>{
 for(const [id] of catalog)
  assert.equal(plan(request(id,"agent:execute")).reason,"unsupported-capability");
});
test("missing trusted entitlement never falls back to a consent flag",()=>{
 const r=plan(request("candidate-rediscovery","candidate-match-preview",{entitlement:null,consent:true}));
 assert.equal(r.ok,false);assert.equal(r.reason,"service-entitlement-required");
});
test("no arbitrary entitlement metadata, prompts or secrets are reflected",()=>{
 const base=request("agent-audit-control","agent-run-review");
 base.entitlement.apiKey="DO_NOT_EXPOSE";base.entitlement.rawPrompt="PRIVATE";
 const r=plan(base);assert.equal(r.ok,true);
 assert.equal(JSON.stringify(r).includes("DO_NOT_EXPOSE"),false);
 assert.equal(JSON.stringify(r).includes("PRIVATE"),false);
});

test("plan boundary rejects malformed revocation flags for all services",()=>{
 for(const [id,capability,sensitive] of catalog){
  const base=request(id,capability);
  assert.equal(plan({...base,entitlement:{...base.entitlement,revoked:"true"}}).ok,false);
  assert.equal(plan({...base,entitlement:{...base.entitlement,revoked:null}}).ok,false);
  if(sensitive){
   assert.equal(plan({...base,entitlement:{...base.entitlement,consentRevoked:"true"}}).reason,"verified-consent-required");
   assert.equal(plan({...base,entitlement:{...base.entitlement,consentRevoked:null}}).reason,"verified-consent-required");
  }
 }
});

test("legacy planner requires verified actor and tenant membership for all four services",()=>{
 for(const [id,capability] of catalog){
  const base=request(id,capability);
  for(const patch of [
   {actor:undefined},{actor:{id:"user_1",authenticated:false}},
   {membership:undefined},{membership:{...base.membership,verified:false}},
   {membership:{...base.membership,actorId:"other_user"}},
   {membership:{...base.membership,tenantId:"other_client"}},
  ]){
   const result=plan({...base,...patch});
   assert.equal(result.ok,false,`${id} must reject untrusted actor/membership`);
   assert.equal(result.executes,false);
   assert.equal("auditEvent" in result,false);
  }
 }
});

test("legacy planner enforces owner-only scope and independent preview flag",()=>{
 for(const [id,capability] of catalog.slice(0,2)){
  const base=request(id,capability);
  for(const role of ["manager","analyst","agent"]){
   const result=plan({...base,membership:{...base.membership,role}});
   assert.equal(result.reason,"owner-required");
   assert.equal("auditEvent" in result,false);
  }
  assert.equal(plan({...base,featureEnabled:false}).reason,"feature-disabled");
  assert.equal(plan({...base,featureEnabled:"true"}).reason,"feature-disabled");
 }
});
