import test from "node:test";
import assert from "node:assert/strict";
import {authorizeLaunchPreview as authorize} from "../lib/ai-visibility-launch-preview-authorization.mjs";
const id="550e8400-e29b-41d4-a716-446655440000";
const session={verified:true,kind:"client",clientId:id,subjectClientId:id};
const now=new Date("2026-10-24T12:00:00Z");
const row={client_id:id,service_id:"agent-audit-control",status:"active",valid_from:"2026-01-01",expires_at:null,revoked_at:null};
test("unverified sessions never reach database",async()=>{
 let called=false;const db={query:async()=>{called=true;return {rows:[row]}}};
 assert.equal((await authorize({verifiedSession:{clientId:id},serviceId:"agent-audit-control",db,now})).allowed,false);
 assert.equal(called,false);
});
test("mismatched session tenant never reaches database",async()=>{
 let called=false;const db={query:async()=>{called=true;return {rows:[row]}}};
 assert.equal((await authorize({verifiedSession:{...session,subjectClientId:"other"},serviceId:"agent-audit-control",db,now})).allowed,false);
 assert.equal(called,false);
});
test("verified matching client can access own active service",async()=>{
 const db={query:async(sql,params)=>{assert.deepEqual(params,[id,"agent-audit-control"]);return {rows:[row]}}};
 assert.equal((await authorize({verifiedSession:session,serviceId:"agent-audit-control",db,now})).allowed,true);
});
test("cross-tenant DB record is rejected",async()=>{
 const db={query:async()=>({rows:[{...row,client_id:"other"}]})};
 assert.equal((await authorize({verifiedSession:session,serviceId:"agent-audit-control",db,now})).allowed,false);
});
