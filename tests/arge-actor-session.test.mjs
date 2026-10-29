import test from 'node:test';
import assert from 'node:assert/strict';
import {issueArgeActorSession,verifyArgeActorSession} from '../lib/arge-actor-session.mjs';

const secret='synthetic-test-secret-at-least-32-bytes';
const issue=(extra={})=>issueArgeActorSession({tenantId:'tenant-1',actorId:'actor-1',secret,now:1000,...extra});
const verify=(token,extra={})=>verifyArgeActorSession(token,{secret,tenantId:'tenant-1',now:1000,...extra});

test('signed actor is distinct from tenant and expires exactly at deadline',()=>{
 const token=issue();
 assert.deepEqual(verify(token),{clientId:'tenant-1',actorId:'actor-1',verified:true,exp:1900});
 assert.equal(verify(token,{now:1900}),null);
 assert.equal(verify(token,{now:999}),null);
});
test('wrong tenant, tampering, wrong secret and malformed tokens fail closed',()=>{
 const token=issue();
 assert.equal(verify(token,{tenantId:'tenant-2'}),null);
 assert.equal(verify(token,{secret:'different-synthetic-secret-32-bytes-long'}),null);
 assert.equal(verify(token+'A'),null);
 assert.equal(verify('bad.token.more'),null);
 assert.equal(verify('x'.repeat(2049)),null);
});
test('issuance rejects invalid IDs, weak secrets and excessive lifetime',()=>{
 for(const extra of [{actorId:''},{tenantId:'../tenant'},{secret:'short'},{ttl:3601},{ttl:0},{now:1.5}])assert.throws(()=>issue(extra));
});
