import test from "node:test";
import assert from "node:assert/strict";
import {zeraRegistrationReadbackMatches as matches} from "../pilot/zera-registration-readback.mjs";
const id="550e8400-e29b-41d4-a716-446655440000";
const registration={clientId:id,created:true,status:"registered"};
test("accepts a matching persistent repository readback",()=>{
 assert.equal(matches(registration,{id,name:"ZERA"}),true);
});
test("rejects missing readback after registration write",()=>{
 assert.equal(matches(registration,null),false);
 assert.equal(matches(registration,undefined),false);
});
test("rejects mismatched client identities",()=>{
 assert.equal(matches(registration,{id:"another-client"}),false);
});
test("rejects malformed registration and readback objects",()=>{
 assert.equal(matches({}, {id}),false);
 assert.equal(matches(null,{id}),false);
 assert.equal(matches({clientId:id},{id:123}),false);
});
test("accepts matching existing client for idempotent retry",()=>{
 assert.equal(matches({...registration,created:false,status:"existing-profile-verified"},{id}),true);
});
