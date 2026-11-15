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
