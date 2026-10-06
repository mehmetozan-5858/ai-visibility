import {requireAdmin,enforceSameOrigin} from "../../../lib/api-security";
import {getCommunicationProspect,markProspectCommunicationSent} from "../../../lib/prospects";
import {sendBrandedOutreach} from "../../../lib/outreach-email";
import {databasePool} from "../../../lib/database-runtime";
import {getDatabaseUrl} from "../../../lib/db";
export const runtime="nodejs";
async function deliveryStatus(emailId){
  if(!/^[0-9a-f-]{36}$/i.test(emailId))return Response.json({error:"Geçersiz gönderim kaydı."},{status:400});
  try{const row=(await databasePool(getDatabaseUrl()).query("SELECT provider_id,payload FROM email_deliveries WHERE provider_id=$1 AND delivery_key LIKE 'prospect-first/%'",[emailId])).rows[0];
   if(!row)return Response.json({error:"Gönderim kaydı bulunamadı."},{status:404});
   const r=await fetch(`https://api.resend.com/emails/${encodeURIComponent(emailId)}`,{headers:{authorization:`Bearer ${process.env.RESEND_RECEIVING_API_KEY||process.env.RESEND_API_KEY}`},signal:AbortSignal.timeout(15000)});
   if(!r.ok)return Response.json({verified:false,providerStatus:r.status,code:[401,403].includes(r.status)?"read-access-required":"provider-unavailable",error:[401,403].includes(r.status)?"E-posta gönderimi kayıtlı; teslimat sorgusu için Resend okuma yetkisi gerekli.":`Resend teslimat sorgusunu tamamlayamadı (${r.status}); teslimat doğrulanmadı.`},{headers:{"cache-control":"no-store"}});
   const d=await r.json();if(d.id!==emailId)return Response.json({error:"Gönderim kimliği uyuşmuyor."},{status:502});
   return Response.json({id:emailId,verified:true,event:d.last_event||"unknown"},{headers:{"cache-control":"no-store"}});
  }catch{return Response.json({error:"Teslimat henüz doğrulanamadı."},{status:503})}
}
export async function GET(req){
 const denied=await requireAdmin(req);if(denied)return denied;
 const emailId=req.headers.get("x-delivery-id")||new URL(req.url).searchParams.get("emailId");
 if(emailId)return deliveryStatus(emailId);
 const from=process.env.OUTREACH_EMAIL_FROM||process.env.EMAIL_FROM||process.env.RESEND_FROM_EMAIL||"";
 const configured=Boolean(process.env.RESEND_API_KEY&&from&&!/@resend\.dev\b/i.test(from));
 let recent=[];try{recent=(await databasePool(getDatabaseUrl()).query("SELECT d.provider_id AS id,p.name,d.payload->'to' AS recipients FROM email_deliveries d LEFT JOIN prospects p ON p.id::text=split_part(d.delivery_key,'/',2) WHERE d.delivery_key LIKE 'prospect-first/%' AND d.status='completed' ORDER BY d.completed_at DESC LIMIT 20")).rows}catch{}
 return Response.json({from,configured,recent,reason:configured?"":!from?"Gönderici e-postası tanımlanmamış.":/@resend\.dev\b/i.test(from)?"Resend test göndericisi dış müşterilere gönderim için uygun değil; doğrulanmış alan adı gerekli.":"E-posta sağlayıcısı yapılandırılmamış."},{headers:{"cache-control":"no-store"}});
}
export async function POST(req){
 const denied=await requireAdmin(req);if(denied)return denied;const originError=enforceSameOrigin(req);if(originError)return originError;
 try{
  const {prospectId,draft,action,emailId}=await req.json();if(action==="delivery-status")return deliveryStatus(String(emailId||"invalid"));if(!prospectId)return Response.json({error:"Aday gerekli."},{status:400});
  if(draft!==undefined&&(typeof draft!=="string"||draft.trim().length<30||draft.length>6000))return Response.json({error:"Mesaj 30–6000 karakter olmalı."},{status:400});
  const x=await getCommunicationProspect(prospectId);if(!x)return Response.json({error:"Aday bulunamadı."},{status:404});
  if(x.communicationStatus!=="ready-for-review"||x.contactStatus!=="verified"||!x.contactEmail)return Response.json({error:"Gönderim güvenlik koşulları sağlanmıyor."},{status:409});
  const sender=process.env.OUTREACH_EMAIL_FROM||process.env.EMAIL_FROM||process.env.RESEND_FROM_EMAIL||"";
  if(/@resend\.dev\b/i.test(sender))return Response.json({error:"Doğrulanmış kurumsal gönderici alan adı gerekli."},{status:409});
  let row;const sent=await sendBrandedOutreach({...x,firstContact:true,...(draft!==undefined?{outreachDraft:draft.trim()}:{})},{key:`prospect-first/${x.id}`,finalize:async id=>{row=await markProspectCommunicationSent(x.id,id)}});
  return Response.json({ok:true,delivery:sent,prospect:row});
 }catch(e){return Response.json({error:"E-posta gönderilemedi.",detail:String(e?.message||e).slice(0,180)},{status:500})}
}
