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
