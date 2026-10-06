import {verifyInboundWebhook} from '../../../../lib/inbound-validation';
import {after} from 'next/server';
import {withRequestBudget} from '../../../../lib/request-budget';
import {enqueueInbound,processInbound} from '../../../../lib/inbound-mail';
export const runtime='nodejs';
export const maxDuration=90;
export async function POST(req){
 if(!process.env.RESEND_WEBHOOK_SECRET)return Response.json({error:'Webhook bağlantısı yapılandırılmadı.'},{status:503});
 const payload=await req.text();if(Buffer.byteLength(payload)>65536)return Response.json({error:'Payload too large'},{status:413});
 let event;try{event=verifyInboundWebhook(payload,req.headers,process.env.RESEND_WEBHOOK_SECRET)}catch{return Response.json({error:'Invalid signature'},{status:401})}
 if(event.type!=='email.received')return Response.json({ok:true,ignored:true});
 try{const inserted=await enqueueInbound(req.headers.get('svix-id'),event);after(async()=>{
   try{const result=await withRequestBudget(65000,()=>processInbound());console.info('inbound-processing',JSON.stringify({skipped:result.skipped||null,statuses:(result.results||[]).map(x=>x.status)}))}
   catch{console.error('inbound-processing-failed')}
  });return Response.json({ok:true,duplicate:!inserted})}
 catch{return Response.json({error:'Email could not be queued'},{status:500})}
}
