import {verifyInboundWebhook} from '../../../../lib/inbound-validation';
import {enqueueInbound} from '../../../../lib/inbound-mail';
export const runtime='nodejs';
export async function POST(req){
 if(!process.env.RESEND_WEBHOOK_SECRET)return Response.json({error:'Webhook bağlantısı yapılandırılmadı.'},{status:503});
 const payload=await req.text();if(Buffer.byteLength(payload)>65536)return Response.json({error:'Payload too large'},{status:413});
 let event;try{event=verifyInboundWebhook(payload,req.headers,process.env.RESEND_WEBHOOK_SECRET)}catch{return Response.json({error:'Invalid signature'},{status:401})}
 if(event.type!=='email.received')return Response.json({ok:true,ignored:true});
 try{const inserted=await enqueueInbound(req.headers.get('svix-id'),event);return Response.json({ok:true,duplicate:!inserted})}
 catch{return Response.json({error:'Email could not be queued'},{status:500})}
}
