import test from "node:test";
import assert from "node:assert/strict";
import {readLaunchServiceEntitlement as read} from "../lib/ai-visibility-launch-entitlement-reader.mjs";
const id="550e8400-e29b-41d4-a716-446655440000",now=new Date("2026-10-24T12:00:00Z");
const base={session:{clientId:id},serviceId:"agent-audit-control",now};
const row={client_id:id,service_id:"agent-audit-control",status:"active",valid_from:"2026-01-01T00:00:00Z",expires_at:null,revoked_at:null};
const db=(rows)=>({query:async(text,values)=>{assert.deepEqual(values,[id,"agent-audit-control"]);return {rows}}});
test("allows matching current entitlement",async()=>assert.equal((await read({...base,db:db([row])})).allowed,true));
test("denies absent or wrong-tenant entitlements",async()=>{
 assert.equal((await read({...base,db:db([])})).allowed,false);
 assert.equal((await read({...base,db:db([{...row,client_id:"other"}])})).allowed,false);
});
test("denies revoked and expired entitlements",async()=>{
 assert.equal((await read({...base,db:db([{...row,revoked_at:"2026-01-01"}])})).allowed,false);
 assert.equal((await read({...base,db:db([{...row,expires_at:"2026-10-23"}])})).allowed,false);
});
test("sensitive services require dated consent",async()=>{
 const serviceId="voice-revenue-agent";
 const input={...base,serviceId,db:{query:async()=>({rows:[{...row,service_id:serviceId}]})}};
 assert.equal((await read(input)).reason,"consent-required");
 assert.equal((await read({...input,db:{query:async()=>({rows:[{...row,service_id:serviceId,consent_verified_at:"2026-01-01"}]})}})).allowed,true);
});
test("database failure denies access",async()=>assert.equal((await read({...base,db:{query:async()=>{throw Error("offline")}}})).allowed,false));
