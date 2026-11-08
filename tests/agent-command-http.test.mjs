import test from 'node:test';
import assert from 'node:assert/strict';
import {createCommandControl} from '../lib/agent-command-control.js';
import {createAgentIdentityResolver} from '../lib/agent-command-identity.js';
import {createAgentCommandHandler} from '../lib/agent-command-http.js';

const task={id:'http-task',tenantId:'internal',project:'ai-visibility',action:'acceptance.review'};
function fixture(){
 const resolver=createAgentIdentityResolver({keys:{test:'x'.repeat(32)},getAgent:()=>({enabled:true,tenantId:'internal',projects:['ai-visibility'],actions:['acceptance.review']})});
 const token=resolver.issue({actorId:'agent',keyId:'test'}),control=createCommandControl();
 const handler=createAgentCommandHandler({enabled:()=>true,resolvePrincipal:t=>resolver.resolve(t),getControl:()=>control});
 const request=(input,authorization='Bearer '+token)=>new Request('https://example.org/api/command-control',
  {method:'POST',headers:{'content-type':'application/json',authorization},body:JSON.stringify(input)});
 return {handler,request,token};
}
test('signed agent can enqueue and review while provider dispatch stays disabled',async()=>{
 const {handler,request}=fixture();
 assert.equal((await handler(request({operation:'enqueue',task}))).status,200);
 const result=await handler(request({operation:'review',taskId:task.id,gates:[{id:'mobile',status:'pending'}]}));
 const data=await result.json();assert.equal(data.task.state,'reviewed');assert.equal(data.providerExecuted,false);
 assert.equal(result.headers.get('cache-control'),'no-store');
 assert.equal((await handler(request({operation:'enqueue',task}))).status,409);
});
test('unsigned identity, client grants and cross-tenant tasks are rejected',async()=>{
 const {handler,request}=fixture();
 assert.equal((await handler(request({operation:'enqueue',task},'Bearer forged'))).status,401);
 assert.equal((await handler(request({operation:'enqueue',task,principal:{authenticated:true}}))).status,400);
 assert.equal((await handler(request({operation:'enqueue',task:{...task,tenantId:'other'}}))).status,403);
});
test('disabled service, large bodies and database failures fail closed without secrets',async()=>{
 const {handler,request}=fixture();
 const disabled=createAgentCommandHandler({enabled:()=>false,resolvePrincipal:()=>{throw Error('must not run');}});
 assert.equal((await disabled(request({}))).status,503);
 assert.equal((await handler(request({padding:'x'.repeat(70000)}))).status,413);
 const failed=createAgentCommandHandler({enabled:()=>true,resolvePrincipal:()=>({}),getControl:()=>{throw Error('postgres://secret');}});
 const result=await failed(request({operation:'enqueue',task}));
 assert.equal(result.status,503);assert.ok(!(await result.text()).includes('secret'));
});
