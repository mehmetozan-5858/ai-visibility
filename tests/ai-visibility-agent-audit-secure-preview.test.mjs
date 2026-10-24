import test from "node:test";
import assert from "node:assert/strict";
import {prepareAuthorizedAgentAuditReport as prepare} from "../lib/ai-visibility-agent-audit-secure-preview.mjs";

const id="550e8400-e29b-41d4-a716-446655440000";
const other="550e8400-e29b-41d4-a716-446655440001";
const now=new Date("2026-10-24T12:00:00.000Z");
const row={client_id:id,service_id:"agent-audit-control",status:"active",
  valid_from:"2026-01-01",expires_at:null,revoked_at:null};
const sample={clientId:id,id:"agent_1",runs:20,failures:3,
  humanHandoffs:1,estimatedCostCents:25,prompt:"PRIVATE",apiKey:"SECRET"};
const base={
  cookieToken:"signed",verifyClientToken:async()=>({clientId:id}),
  entitlementDb:{query:async(_sql,params)=>{
    assert.deepEqual(params,[id,"agent-audit-control"]);
    return {rows:[row]};
  }},
  loadAggregatedMetrics:async tenant=>{
    assert.equal(tenant,id);
    return [sample];
  },
  now
};

test("verified entitled tenant gets only sanitized audit report",async()=>{
 const r=await prepare(base);
 assert.equal(r.ok,true);
 assert.equal(r.clientId,id);
 assert.equal(r.serviceId,"agent-audit-control");
 assert.equal(r.generatedAt,now.toISOString());
 assert.equal(r.agents[0].failureRatePercent,15);
 assert.equal(JSON.stringify(r).includes("PRIVATE"),false);
 assert.equal(JSON.stringify(r).includes("SECRET"),false);
});
test("invalid signed cookie blocks DB and metrics reads",async()=>{
 let queried=false,loaded=false;
 const r=await prepare({...base,verifyClientToken:async()=>null,
   entitlementDb:{query:async()=>{queried=true;return {rows:[row]}}},
   loadAggregatedMetrics:async()=>{loaded=true;return [sample]}});
 assert.equal(r.ok,false);
 assert.equal(queried,false);
 assert.equal(loaded,false);
});
test("missing service entitlement prevents metrics read",async()=>{
 let loaded=false;
 const r=await prepare({...base,
   entitlementDb:{query:async()=>({rows:[]})},
   loadAggregatedMetrics:async()=>{loaded=true;return [sample]}});
 assert.equal(r.ok,false);
 assert.equal(loaded,false);
});
test("cross-tenant metrics are rejected instead of partially reported",async()=>{
 const r=await prepare({...base,
   loadAggregatedMetrics:async()=>[sample,{...sample,clientId:other}]});
 assert.equal(r.ok,false);
 assert.equal(r.reason,"cross-tenant-record");
});
test("metrics loader failures return safe error without leaking details",async()=>{
 const r=await prepare({...base,
   loadAggregatedMetrics:async()=>{throw Error("PRIVATE DB CONNECTION");}});
 assert.deepEqual(r,{ok:false,reason:"metrics-unavailable"});
});
test("invalid time and missing loader fail before querying entitlement",async()=>{
 let queried=false;
 const db={query:async()=>{queried=true;return {rows:[row]}}};
 assert.equal((await prepare({...base,now:new Date(NaN),entitlementDb:db})).reason,"invalid-time");
 assert.equal((await prepare({...base,loadAggregatedMetrics:null,entitlementDb:db})).reason,"metrics-loader-unavailable");
 assert.equal(queried,false);
});

test("rejects duplicate agent rows from trusted metrics loader",async()=>{
 const r=await prepare({...base,loadAggregatedMetrics:async()=>[sample,{...sample,runs:40,failures:1}]});
 assert.equal(r.ok,false);
 assert.equal(r.reason,"duplicate-agent-id");
 assert.equal(r.agents,undefined);
});
