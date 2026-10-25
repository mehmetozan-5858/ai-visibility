import test from "node:test";
import assert from "node:assert/strict";
import {authorizeLaunchAction, launchRolePermissions} from "../lib/ai-visibility-launch-access.mjs";
const actor={id:"user_01",authenticated:true};
const membership={actorId:"user_01",tenantId:"tenant_01",role:"owner",verified:true};
const ask=(patch={})=>authorizeLaunchAction({actor,membership,resourceTenantId:"tenant_01",action:"report:read",featureEnabled:true,...patch});
test("valid owner can read own tenant when enabled",()=>assert.equal(ask().allowed,true));
test("auth required",()=>assert.equal(ask({actor:{id:"user_01",authenticated:false}}).reason,"unauthenticated"));
test("membership must be verified and associated with actor",()=>{
 assert.equal(ask({membership:{...membership,verified:false}}).reason,"unverified-membership");
 assert.equal(ask({membership:{...membership,actorId:"different"}}).reason,"unverified-membership");
});
test("cross tenant access denied even to owners",()=>assert.equal(ask({resourceTenantId:"tenant_02"}).reason,"cross-tenant-denied"));
test("launch modules default disabled",()=>assert.equal(ask({featureEnabled:false}).reason,"feature-disabled"));
test("viewer cannot create reports or manage customers",()=>{
 const m={...membership,role:"viewer"};
 assert.equal(ask({membership:m,action:"report:create"}).reason,"insufficient-permission");
 assert.equal(ask({membership:m,action:"customer:manage"}).reason,"insufficient-permission");
});
test("agents cannot execute or modify settings even when flag enabled",()=>{
 assert.equal(ask({action:"agent:execute"}).reason,"requires-separate-production-approval");
 assert.equal(ask({action:"settings:write"}).reason,"requires-separate-production-approval");
});
test("unknown action and malformed ids fail closed",()=>{
 assert.equal(ask({action:"send:email"}).reason,"insufficient-permission");
 assert.equal(ask({resourceTenantId:"../../elsewhere"}).reason,"cross-tenant-denied");
});
test("permission copies do not mutate roles",()=>{
 const copy=launchRolePermissions("owner");copy.push("send:email");
 assert.ok(!launchRolePermissions("owner").includes("send:email"));
});

test("only explicit boolean true can enable launch preview access",()=>{
 for(const value of ["false","true",1,0,null,undefined,{},[],["true"]]){
  const result=ask({featureEnabled:value});
  assert.deepEqual(result,{allowed:false,reason:"feature-disabled"});
 }
 assert.equal(ask({featureEnabled:true}).allowed,true);
});
test("truthy misconfigured feature flags cannot unlock any role",()=>{
 for(const role of ["owner","manager","analyst","viewer","agent"]){
  const result=ask({membership:{...membership,role},action:"service:read",featureEnabled:"false"});
  assert.equal(result.allowed,false,role);
  assert.equal(result.reason,"feature-disabled",role);
 }
});

test("unknown and inherited Object property roles have no permissions",()=>{
 for(const role of ["constructor","toString","__proto__","hasOwnProperty","unknown",null,undefined,{},[],1]) {
  assert.deepEqual(launchRolePermissions(role),[],String(role));
 }
 for(const role of ["owner","manager","analyst","viewer","agent"]) {
  assert.ok(launchRolePermissions(role).includes("service:read"),role);
 }
});
