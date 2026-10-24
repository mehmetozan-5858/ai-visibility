import test from "node:test";
import assert from "node:assert/strict";
import {zeraRegistrationResponse,zeraRegistrationFailure} from "../pilot/zera-registration-response.mjs";
test("successful pilot registration response cannot be cached",async()=>{
 const response=zeraRegistrationResponse({pilotId:"ZERA-DE-001",scanStarted:false});
 assert.equal(response.status,200);
 assert.match(response.headers.get("cache-control"),/no-store/);
 assert.equal(response.headers.get("pragma"),"no-cache");
 assert.equal(response.headers.get("vary"),"Cookie");
 assert.equal((await response.json()).scanStarted,false);
});
test("disabled and invalid registration responses cannot be cached",async()=>{
 for(const status of [400,409]){
  const response=zeraRegistrationResponse({error:"not permitted"},status);
  assert.equal(response.status,status);
  assert.match(response.headers.get("cache-control"),/no-store/);
 }
});
test("failure response is generic and excludes internal exception details",async()=>{
 const response=zeraRegistrationFailure();
 assert.equal(response.status,503);
 const body=await response.json();
 assert.deepEqual(body,{error:"Pilot registration could not be completed"});
 assert.equal(Object.hasOwn(body,"reason"),false);
 assert.match(response.headers.get("cache-control"),/no-store/);
});
