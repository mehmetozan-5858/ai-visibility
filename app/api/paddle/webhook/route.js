import {verifyPaddleLiveSignature,recordPaddleLiveEvent} from '../../../../lib/paddle-live.js';

export const runtime='nodejs';

export async function POST(req){
  const secret=process.env.PADDLE_LIVE_WEBHOOK_SECRET||'';
  if(!secret)return Response.json({error:'Paddle live webhook is not configured'},{status:503});
  const raw=await req.text();
  if(Buffer.byteLength(raw)>262144)return Response.json({error:'Payload too large'},{status:413});
  if(!verifyPaddleLiveSignature(raw,req.headers.get('paddle-signature'),secret))return Response.json({error:'Invalid signature'},{status:401});
  let event;
  try{event=JSON.parse(raw)}catch{return Response.json({error:'Invalid JSON'},{status:400})}
  try{
    const result=await recordPaddleLiveEvent(event);
    console.info('Paddle live event processed',result?.eventType||event?.event_type||'unknown',result?.duplicate?'duplicate':result?.recorded?'recorded':'ignored');
    return Response.json(result);
  }catch(error){
    console.error('Paddle live event failed',String(error?.message||error).slice(0,180));
    return Response.json({error:'Paddle live event not recorded; retry required'},{status:503});
  }
}
