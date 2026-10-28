import test from "node:test";
import assert from "node:assert/strict";
import {prepareStoredLaunchPlan} from "../lib/ai-visibility-launch-plan-repository.mjs";
import {LAUNCH_SERVICES} from "../lib/ai-visibility-launch-services.mjs";

const now=Date.parse("2026-10-27T10:00:00.000Z");
const verifiedSession={clientId:"tenant1",actorId:"tenant1",verified:true};
function fixture({role="owner",enabled=true,revoked=false,consentVerified=true,fail=false}={}){
  const queries=[];
  let released=false;
  const pool={async connect(){return {
    async query(sql,params){
      queries.push({sql,params});
      if(sql.includes("FROM arge_memberships"))
        return {rows:[{role,enabled}]};
      if(sql.includes("FROM arge_entitlements")){
        if(fail)throw Error("isolated test database unavailable");
        return {rows:[{status:"active",revoked,
          expiresAt:new Date("2099-01-01T00:00:00.000Z"),
          notBefore:null,consentVerified,consentRevoked:false}]};
      }
      return {rows:[]};
    },
    release(){released=true;},
  };}};
  return {pool,queries,get released(){return released;}};
}
const request=(db,serviceId,capability,extra={})=>prepareStoredLaunchPlan({
  pool:db.pool,verifiedSession,accountClientId:"tenant1",serviceId,capability,
  featureEnabled:true,globallyEnabled:true,now,...extra,
});

test("all 13 capabilities use only tenant-scoped read-only SQL and remain non-executing",async()=>{
  let count=0;
  for(const service of LAUNCH_SERVICES){
    for(const capability of service.capabilities){
      const db=fixture();
      const result=await request(db,service.id,capability);
      assert.equal(result.ok,true,service.id+"/"+capability);
      assert.equal(result.executes,false);
      assert.equal(result.auditPersisted,false);
      assert.equal(result.auditEvent.state,"prepared-not-persisted");
      assert.deepEqual(db.queries.map(q=>q.sql.startsWith("BEGIN")?"BEGIN":
        q.sql.startsWith("COMMIT")?"COMMIT":
        q.sql.includes("FROM arge_memberships")?"membership":"grant"),
        ["BEGIN","membership","grant","COMMIT"]);
      assert.deepEqual(db.queries[1].params,["tenant1","tenant1"]);
      assert.deepEqual(db.queries[2].params,["tenant1",service.id]);
      assert.match(db.queries[0].sql,/READ ONLY/);
      assert.equal(db.released,true);
      count++;
    }
  }
  assert.equal(count,13);
});

test("unverified session, mismatched tenant and disabled flags never touch database",async()=>{
  const db=fixture();
  const service=LAUNCH_SERVICES[0];
  assert.equal((await request(db,service.id,service.capabilities[0],{
    verifiedSession:{...verifiedSession,verified:false}})).reason,"unauthenticated");
  assert.equal((await request(db,service.id,service.capabilities[0],{
    accountClientId:"tenant2"})).reason,"account-session-mismatch");
  assert.equal((await request(db,service.id,service.capabilities[0],{
    featureEnabled:false})).reason,"feature-disabled");
  assert.equal((await request(db,service.id,service.capabilities[0],{
    globallyEnabled:false})).reason,"service-disabled");
  assert.equal(db.queries.length,0);
});

test("revoked grants, disabled membership and missing consent fail without an audit envelope",async()=>{
  const service=LAUNCH_SERVICES[0],sensitive=LAUNCH_SERVICES.find(s=>s.sensitive);
  for(const [db,target] of [[fixture({revoked:true}),service],
    [fixture({enabled:false}),service],
    [fixture({consentVerified:false}),sensitive]]){
    const result=await request(db,target.id,target.capabilities[0]);
    assert.equal(result.ok,false);
    assert.equal("auditEvent" in result,false);
    assert.equal(db.released,true);
  }
});

test("query failure rolls back and fails closed without leaking database errors",async()=>{
  const db=fixture({fail:true});
  const result=await request(db,LAUNCH_SERVICES[0].id,LAUNCH_SERVICES[0].capabilities[0]);
  assert.deepEqual(result,{ok:false,reason:"database-unavailable"});
  assert.equal(db.queries.at(-1).sql,"ROLLBACK");
  assert.equal(db.released,true);
});
