import test from 'node:test';
import assert from 'node:assert/strict';
import {createAgentIdentityResolver} from '../lib/agent-command-identity.js';

function fixture(){
 let now=1000;
 const agents={broker:{enabled:true,tenantId:'internal',projects:['global-broker-ai'],actions:['acceptance.review']}};
 const resolver=createAgentIdentityResolver({keys:{current:'x'.repeat(32)},getAgent:id=>agents[id],clock:()=>now});
 return {agents,resolver,setTime:value=>{now=value;}};
}
test('signed token resolves only server-side scopes and expires',()=>{
 const {resolver,setTime}=fixture();const token=resolver.issue({actorId:'broker',keyId:'current',ttlSeconds:60});
 assert.deepEqual(resolver.resolve(token).projects,['global-broker-ai']);
 setTime(1060);assert.throws(()=>resolver.resolve(token),/invalid-agent-token/);
});
test('tampered, malformed and wrong-key tokens fail closed',()=>{
 const {resolver}=fixture();const token=resolver.issue({actorId:'broker',keyId:'current'});
 const foreign=createAgentIdentityResolver({keys:{current:'y'.repeat(32)},getAgent:()=>null});
 for(const value of ['',null,'a.b',token+'x',token.replace(/.$/,token.endsWith('A')?'B':'A')])
  assert.throws(()=>resolver.resolve(value),/invalid-agent-token/);
 assert.throws(()=>foreign.resolve(token),/invalid-agent-token/);
});
test('current registry revocation and scope changes take effect on the same token',()=>{
 const {resolver,agents}=fixture();const token=resolver.issue({actorId:'broker',keyId:'current'});
 agents.broker.projects=['ai-visibility'];assert.deepEqual(resolver.resolve(token).projects,['ai-visibility']);
 agents.broker.enabled=false;assert.throws(()=>resolver.resolve(token),/invalid-agent-token/);
});
test('unknown agents, excessive lifetimes, weak keys and future-issued tokens are rejected',()=>{
 const {resolver,setTime}=fixture();
 assert.throws(()=>resolver.issue({actorId:'missing',keyId:'current'}));
 assert.throws(()=>resolver.issue({actorId:'broker',keyId:'current',ttlSeconds:901}));
 assert.throws(()=>createAgentIdentityResolver({keys:{current:'short'},getAgent:()=>null}));
 const token=resolver.issue({actorId:'broker',keyId:'current'});setTime(999);
 assert.throws(()=>resolver.resolve(token),/invalid-agent-token/);
});
