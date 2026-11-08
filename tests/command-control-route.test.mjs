import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {commandControlStatus} from '../lib/agent-command-control.js';

test('admin status handler rejects unauthorized access and disables caching',async()=>{
 const source=await readFile(new URL('../app/api/command-control/route.js',import.meta.url),'utf8');
 const executable=source.replace(/^import .*;\n/gm,'').replace(/export /g,'');
 const load=new Function('requireAdmin','commandControlStatus',executable+';return GET;');
 const denied=Response.json({error:'unauthorized'},{status:401});
 const reject=load(async()=>denied,()=>{throw Error('must not run');});
 assert.equal(await reject({}),denied);
 const allow=load(async()=>null,commandControlStatus);
 const response=await allow({});
 assert.equal(response.headers.get('cache-control'),'no-store');
 assert.equal((await response.json()).control.providerExecution,false);
});
test('local CLI reviews three project inputs and rejects forged tenancy without leaking payloads',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'command-review-'));
 try{
  const path=join(dir,'input.json');
  const items=commandControlStatus().projects.map(project=>({
   task:{id:project,tenantId:'internal',project,action:'acceptance.review'},
   gates:[{id:'live-acceptance',status:'pending'}]}));
  await writeFile(path,JSON.stringify(items));
  const cli=new URL('../scripts/review-agent-tasks.mjs',import.meta.url);
  const result=JSON.parse(execFileSync(process.execPath,[cli.pathname,path],{encoding:'utf8'}));
  assert.equal(result.tasks.length,3);assert.equal(result.audit.length,6);
  assert.ok(result.tasks.every(t=>!t.result.releaseAuthorized));
  items[0].task.tenantId='customer-other';
  await writeFile(path,JSON.stringify(items));
  assert.throws(()=>execFileSync(process.execPath,[cli.pathname,path],{encoding:'utf8',stdio:'pipe'}),e=>{
   assert.equal(e.status,1);assert.equal(e.stdout,'');
   assert.ok(!e.stderr.includes('customer-other'));return true;
  });
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('CLI opt-in store retains reviewed tasks across a fresh process',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'command-cli-durable-'));
 try{
  const path=join(dir,'input.json'),store=join(dir,'ledger.sqlite');
  const input=[{task:{id:'cli-durable',tenantId:'internal',project:'ai-visibility',action:'acceptance.review'},
   gates:[{id:'mobile',status:'unknown'}]}];
  await writeFile(path,JSON.stringify(input));
  const cli=new URL('../scripts/review-agent-tasks.mjs',import.meta.url);
  const args=[cli.pathname,path,'--store',store];
  const first=JSON.parse(execFileSync(process.execPath,args,{encoding:'utf8'}));
  assert.equal(first.storage,'sqlite-local');assert.equal(first.audit.length,2);
  assert.throws(()=>execFileSync(process.execPath,args,{encoding:'utf8',stdio:'pipe'}),e=>e.status===1);
  const {openDurableCommandControl}=await import('../lib/agent-command-sqlite.js');
  const q=openDurableCommandControl(store);
  try{
   const snapshot=q.snapshot({authenticated:true,actorId:'reader',tenantId:'internal',
    projects:['ai-visibility'],actions:['acceptance.review']});
   assert.equal(snapshot.tasks[0].state,'reviewed');assert.equal(snapshot.audit.length,2);
  }finally{q.close();}
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('admin queue status reads only the server-configured actor scope and hides connection errors',async()=>{
 const source=await readFile(new URL('../app/api/command-control/route.js',import.meta.url),'utf8');
 const executable=source.replace(/^import .*;\n/gm,'').replace(/export /g,'');
 const load=new Function('requireAdmin','commandControlStatus','resolveRegisteredAgent','createPostgresCommandControl','databasePool',executable+';return GET;');
 const {resolveRegisteredAgent}=await import('../lib/agent-command-identity.js');
 const keys=['AGENT_COMMAND_CONTROL_ENABLED','AGENT_COMMAND_DATABASE_URL','AGENT_COMMAND_ADMIN_ACTOR_ID','AGENT_COMMAND_AGENTS_JSON'];
 const previous=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 try{
  process.env.AGENT_COMMAND_CONTROL_ENABLED='true';process.env.AGENT_COMMAND_DATABASE_URL='postgres://not-a-real-connection';
  process.env.AGENT_COMMAND_ADMIN_ACTOR_ID='reader';process.env.AGENT_COMMAND_AGENTS_JSON=JSON.stringify({reader:{enabled:true,tenantId:'internal',projects:['global-broker-ai'],actions:['acceptance.review']}});
  let scope;
  const get=load(async()=>null,commandControlStatus,resolveRegisteredAgent,()=>({snapshot:async principal=>{scope=principal;return {tasks:[],audit:[]}}}),()=>({}));
  const ok=await (await get({})).json();assert.equal(ok.control.queueStatus,'available');
  assert.deepEqual(scope.projects,['global-broker-ai']);assert.equal(scope.tenantId,'internal');
  const broken=load(async()=>null,commandControlStatus,resolveRegisteredAgent,()=>{throw Error('secret connection details')},()=>({}));
  const failed=await (await broken({})).json();assert.equal(failed.control.queueStatus,'unavailable');assert.equal(failed.snapshot,null);
  assert.ok(!JSON.stringify(failed).includes('secret connection details'));
 }finally{for(const k of keys){if(previous[k]===undefined)delete process.env[k];else process.env[k]=previous[k];}}
});
