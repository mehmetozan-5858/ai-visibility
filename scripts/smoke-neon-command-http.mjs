/** Built Next.js app against an explicitly supplied isolated Neon branch. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomBytes,randomUUID} from 'node:crypto';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {createAdminToken} from '../lib/admin-auth.js';
import {createAgentIdentityResolver} from '../lib/agent-command-identity.js';
const target=new URL(process.env.AGENT_TEST_DATABASE_URL||'');
assert.equal(target.hostname,process.env.AGENT_TEST_EXPECTED_HOST,'unexpected-isolated-host');
assert.equal(decodeURIComponent(target.username),'agent_test_writer_20261109','unexpected-writer');
target.searchParams.set('sslmode','verify-full');
const reader=new URL(target);reader.username='agent_test_reader_20261109';reader.password=process.env.AGENT_TEST_READER_PASSWORD;
assert.ok(reader.password,'missing-reader-password');
const key=randomBytes(32).toString('hex'),auth=randomBytes(32).toString('hex');
const agents={acceptance:{enabled:true,tenantId:'internal',projects:['ai-visibility'],actions:['acceptance.review']}};
const resolver=createAgentIdentityResolver({keys:{acceptance:key},getAgent:id=>agents[id]});
process.env.AUTH_SECRET=auth;process.env.ADMIN_PASSWORD=randomBytes(32).toString('hex');
const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');
const port=probe.address().port;await new Promise(r=>probe.close(r));
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{stdio:'ignore',env:{
 PATH:process.env.PATH,NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1',AUTH_SECRET:auth,ADMIN_PASSWORD:process.env.ADMIN_PASSWORD,
 AGENT_COMMAND_CONTROL_ENABLED:'true',AGENT_COMMAND_DATABASE_URL:target.href,AGENT_COMMAND_READ_DATABASE_URL:reader.href,
 AGENT_COMMAND_KEYS_JSON:JSON.stringify({acceptance:key}),AGENT_COMMAND_AGENTS_JSON:JSON.stringify(agents),AGENT_COMMAND_ADMIN_ACTOR_ID:'acceptance'}});
try{
 const origin='http://127.0.0.1:'+port,url=origin+'/api/command-control';let ready=false;
 for(let i=0;i<50;i++){
  if(server.exitCode!==null)throw Error('built-server-exited');
  try{await fetch(url);ready=true;break}catch{await new Promise(r=>setTimeout(r,200))}
 }
 assert.ok(ready,'built-server-not-ready');
 const admin=await createAdminToken(),cookie={cookie:'ai_admin='+admin};
 assert.equal((await fetch(url)).status,401);
 const task={id:'built-http-'+randomUUID(),tenantId:'internal',project:'ai-visibility',action:'acceptance.review'};
 const token=resolver.issue({actorId:'acceptance',keyId:'acceptance'});
 const post=async(input,bearer=token)=>fetch(url,{method:'POST',headers:{authorization:'Bearer '+bearer,'content-type':'application/json'},body:JSON.stringify(input)});
 assert.equal((await post({operation:'enqueue',task})).status,200);
 assert.equal((await post({operation:'enqueue',task})).status,409);
 assert.equal((await post({operation:'enqueue',task:{...task,id:'forbidden-'+randomUUID(),tenantId:'other'}})).status,403);
 assert.equal((await post({operation:'enqueue',task},'invalid.token.value')).status,401);
 assert.equal((await post({operation:'review',taskId:task.id,gates:[{id:'production',status:'pending'}]})).status,200);
 const response=await fetch(url,{headers:cookie});assert.equal(response.status,200);
 const body=await response.json();assert.equal(body.control.queueStatus,'available');assert.equal(body.control.storage,'postgresql');
 const stored=body.snapshot.tasks.find(t=>t.id===task.id);assert.equal(stored.state,'reviewed');assert.equal(stored.result.releaseAuthorized,false);
 assert.equal((await fetch(origin+'/admin/arge',{headers:cookie,redirect:'manual'})).status,200);
 console.log(JSON.stringify({ok:true,scope:'built-next-http-to-isolated-neon',anonymousGet:401,signedPostWithoutAdminCookie:200,duplicate:409,wrongTenant:403,invalidToken:401,reviewAndReadback:true,adminPage:200,releaseAuthorized:false,productionDatabaseTouched:false,providerExecuted:false}));
}catch(error){console.error(JSON.stringify({ok:false,code:error.code||null,message:String(error.message).replace(/postgres(?:ql)?:\/\/\S+/g,'[redacted]')}));process.exitCode=1;}
finally{if(server.exitCode===null){const closed=once(server,'exit');server.kill('SIGTERM');await closed;}}
