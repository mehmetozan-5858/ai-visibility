import test from "node:test";
import assert from "node:assert/strict";
import {authorizeLaunchFromClientCookie as authorize} from "../lib/ai-visibility-launch-cookie-auth.mjs";
const id="550e8400-e29b-41d4-a716-446655440000";
const row={client_id:id,service_id:"agent-audit-control",status:"active",valid_from:"2026-01-01",expires_at:null,revoked_at:null};
const base={cookieToken:"signed-cookie",serviceId:"agent-audit-control",now:new Date("2026-10-24T12:00:00Z")};
test("reject missing cookie before verifier or db",async()=>{
 let queried=false;const db={query:async()=>{queried=true;return {rows:[row]}}};
 assert.equal((await authorize({...base,cookieToken:"",db,verifyClientToken:async()=>({clientId:id})})).allowed,false);
 assert.equal(queried,false);
});
test("reject invalid signature without querying db",async()=>{
 let queried=false;const db={query:async()=>{queried=true;return {rows:[row]}}};
 assert.equal((await authorize({...base,db,verifyClientToken:async()=>null})).allowed,false);
 assert.equal(queried,false);
});
test("signed session scopes parameterized query to verified client",async()=>{
 const db={query:async(sql,values)=>{assert.deepEqual(values,[id,"agent-audit-control"]);return {rows:[row]}}};
 assert.equal((await authorize({...base,db,verifyClientToken:async()=>({clientId:id})})).allowed,true);
});
test("demo client id denied even with signed session",async()=>{
 let queried=false;const db={query:async()=>{queried=true;return {rows:[row]}}};
 assert.equal((await authorize({...base,db,verifyClientToken:async()=>({clientId:"demo-1"})})).allowed,false);
 assert.equal(queried,false);
});
