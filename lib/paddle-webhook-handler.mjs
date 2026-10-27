import {verifyPaddleLiveSignature,recordPaddleLiveEvent} from './paddle-live.js';

// The route and isolated HTTP test share signature, size and error handling.
// Dependencies are server-owned; request data cannot choose its recorder.
export function createPaddleWebhookHandler({getSecret=()=>process.env.PADDLE_LIVE_WEBHOOK_SECRET||'',record=recordPaddleLiveEvent}={}){
 return async function POST(req){
  const secret=getSecret();
  if(!secret)return Response.json({error:'Paddle live webhook is not configured'},{status:503});
  const raw=await req.text();
  if(Buffer.byteLength(raw)>262144)return Response.json({error:'Payload too large'},{status:413});
  if(!verifyPaddleLiveSignature(raw,req.headers.get('paddle-signature'),secret))return Response.json({error:'Invalid signature'},{status:401});
  let event;
  try{event=JSON.parse(raw)}catch{return Response.json({error:'Invalid JSON'},{status:400})}
  try{return Response.json(await record(event))}
  catch{
   // Never publish or log raw SQL/provider errors, keys or customer payloads.
   console.error('Paddle live event processing failed; retry required');
   return Response.json({error:'Paddle live event not recorded; retry required'},{status:503});
  }
 };
}
