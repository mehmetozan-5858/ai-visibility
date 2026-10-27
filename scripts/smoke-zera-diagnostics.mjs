/** Run after npm run build; starts only a local server with synthetic auth and no DB URL. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {createAdminToken} from '../lib/admin-auth.js';
const previous={AUTH_SECRET:process.env.AUTH_SECRET,ADMIN_PASSWORD:process.env.ADMIN_PASSWORD};
process.env.AUTH_SECRET=randomBytes(32).toString('hex');process.env.ADMIN_PASSWORD=randomBytes(24).toString('hex');
const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');
const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{
 stdio:'ignore',env:{PATH:process.env.PATH,NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1',AUTH_SECRET:process.env.AUTH_SECRET,ADMIN_PASSWORD:process.env.ADMIN_PASSWORD}});
try{
 const origin='http://127.0.0.1:'+port;
 let ready=false;
 for(let i=0;i<50;i++){
  if(server.exitCode!==null)throw Error('Local server exited');
  try{await fetch(origin);ready=true;break}catch{await new Promise(resolve=>setTimeout(resolve,200))}
 }
 assert.equal(ready,true);
 const url=origin+'/api/clients/zera-diagnostics',token=await createAdminToken(),headers={cookie:'ai_admin='+token};
 assert.equal((await fetch(url)).status,401);
 assert.equal((await fetch(url,{method:'POST',headers})).status,405);
 assert.equal((await fetch(url+'?clientId=other',{headers})).status,400);
 const response=await fetch(url,{headers});assert.equal(response.status,503);
 assert.match(response.headers.get('cache-control'),/no-store/);
 assert.equal((await response.json()).error,'database-not-configured');
 console.log(JSON.stringify({ok:true,scope:'isolated-production-http',unauthenticated:401,writeMethod:405,
  customerSelector:400,missingDatabase:503,realProviderCalls:0,productionDatabaseTouched:false}));
}finally{
 const closed=once(server,'exit');server.kill('SIGTERM');await closed;
 for(const [key,value] of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value}
}
