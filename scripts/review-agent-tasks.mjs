import {readFile} from 'node:fs/promises';
import {createCommandControl,commandControlStatus} from '../lib/agent-command-control.js';

// Local operator tool only. Do not expose this entry point to untrusted HTTP input.
let control;
try{
 const path=process.argv[2];
 const durable=process.argv.length===5 && process.argv[3]==='--store' && process.argv[4];
 if(!path || (process.argv.length!==3 && !durable))throw Error('invalid-arguments');
 const inputText=await readFile(path,'utf8');
 if(Buffer.byteLength(inputText)>256000)throw Error('input-too-large');
 const input=JSON.parse(inputText);
 if(!Array.isArray(input) || !input.length || input.length>100)throw Error('invalid-batch');
 const principal={authenticated:true,actorId:'local-operator',tenantId:'internal',
  projects:commandControlStatus().projects,actions:['acceptance.review']};
 control=durable
  ?(await import('../lib/agent-command-sqlite.js')).openDurableCommandControl(process.argv[4])
  :createCommandControl();
 for(const item of input){
  if(!item || Object.keys(item).some(k=>!['task','gates'].includes(k)))throw Error('invalid-batch-item');
  control.enqueue(item.task,principal);
  control.review(item.task.id,item.gates,principal);
 }
 process.stdout.write(JSON.stringify(control.snapshot(principal),null,2)+'\n');
}catch{
 // Do not echo file contents, JSON parser excerpts or potentially sensitive paths.
 process.stderr.write('Offline review failed: input or permissions invalid.\n');
 process.exitCode=1;
}finally{control?.close?.();}
