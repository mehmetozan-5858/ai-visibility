import pg from 'pg';
import {sandboxEnabled,sandboxDatabaseUrl,verifyPaddleSignature,recordSandboxEvent} from '../../lib/paddle-sandbox.js';
import {linkSandboxIntent} from '../../lib/paddle-sandbox-identity.js';
export async function POST(req){
 if(req.method!=='POST')return Response.json({error:'Method not allowed'},{status:405,headers:{Allow:'POST'}});
 if(!sandboxEnabled())return Response.json({error:'Sandbox disabled'},{status:404});
 const url=sandboxDatabaseUrl(),secret=process.env.PADDLE_SANDBOX_WEBHOOK_SECRET;
 if(!url||!secret)return Response.json({error:'Isolated sandbox storage and webhook secret required'},{status:503});
 const raw=await req.text();if(Buffer.byteLength(raw)>262144)return Response.json({error:'Payload too large'},{status:413});
 if(!verifyPaddleSignature(raw,req.headers.get('paddle-signature'),secret))return Response.json({error:'Invalid signature'},{status:401});
 let event;try{event=JSON.parse(raw)}catch{return Response.json({error:'Invalid JSON'},{status:400})}
 const pool=new pg.Pool({connectionString:url,max:1,connectionTimeoutMillis:3000});
 try{
  const result=await recordSandboxEvent(event,pool,{linkIntent:linkSandboxIntent});
  console.info('Paddle sandbox event processed',result?.recorded?'recorded':result?.duplicate?'duplicate':result?.ignored?'ignored':'ok',String(event?.event_type||''));
  return Response.json(result);
 }
 catch(e){
  const known=['invalid-event','invalid-entity','unknown-price'];
  const code=known.includes(e.message)?e.message:(/^[A-Z0-9_]{2,40}$/.test(e.code||'')?e.code:'storage-error');
  console.warn('Paddle sandbox recording failed',code);
  return Response.json({error:'Sandbox event not recorded; retry required'},{status:503});
 }
 finally{await pool.end()}
}

export default {fetch:POST};
