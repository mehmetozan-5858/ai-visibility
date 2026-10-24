import test from "node:test";
import assert from "node:assert/strict";
import {buildLaunchEntitlementQuery as query} from "../lib/ai-visibility-launch-queries.mjs";
const clientId="550e8400-e29b-41d4-a716-446655440000";
test("parameterized, read-only entitlement lookup",()=>{
 const r=query({clientId,serviceId:"agent-audit-control"});
 assert.equal(r.ok,true);assert.equal(r.readOnly,true);assert.deepEqual(r.values,[clientId,"agent-audit-control"]);
 assert.match(r.text,/client_id=\$1::uuid/);assert.match(r.text,/service_id=\$2/);
 assert.match(r.text,/revoked_at IS NULL/);assert.match(r.text,/expires_at>NOW\(\)/);
});
test("reject demo ID and invalid service",()=>{
 assert.equal(query({clientId:"demo-1",serviceId:"agent-audit-control"}).reason,"invalid-client-id");
 assert.equal(query({clientId,serviceId:"unknown"}).reason,"unknown-service");
});
test("SQL injection cannot enter statement",()=>{
 const r=query({clientId,serviceId:"agent-audit-control'; DROP TABLE clients;--"});
 assert.equal(r.ok,false);
});
