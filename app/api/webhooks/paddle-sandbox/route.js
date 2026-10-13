import pg from 'pg';
import {sandboxEnabled,sandboxDatabaseUrl,verifyPaddleSignature,recordSandboxEvent} from '../../../../lib/paddle-sandbox';
export const runtime='nodejs';
export async function POST(req){
 if(!sandboxEnabled())return Response.json({error:'Sandbox disabled'},{status:404});
 const url=sandboxDatabaseUrl(),secret=process.env.PADDLE_SANDBOX_WEBHOOK_SECRET;
 if(!url||!secret)return Response.json({error:'Isolated sandbox storage and webhook secret required'},{status:503});
 const raw=await req.text();if(Buffer.byteLength(raw)>262144)return Response.json({error:'Payload too large'},{status:413});
 if(!verifyPaddleSignature(raw,req.headers.get('paddle-signature'),secret))return Response.json({error:'Invalid signature'},{status:401});
 let event;try{event=JSON.parse(raw)}catch{return Response.json({error:'Invalid JSON'},{status:400})}
 const pool=new pg.Pool({connectionString:url,max:1,connectionTimeoutMillis:3000});
 try{return Response.json(await recordSandboxEvent(event,pool))}
 catch{return Response.json({error:'Sandbox event not recorded; retry required'},{status:503})}
 finally{await pool.end()}
}
