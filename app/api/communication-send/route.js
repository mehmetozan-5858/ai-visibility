import {requireAdmin,enforceSameOrigin} from "../../../lib/api-security";
import {getCommunicationProspect,markProspectCommunicationSent} from "../../../lib/prospects";
import {sendBrandedOutreach} from "../../../lib/outreach-email";
export const runtime="nodejs";
export async function GET(req){
 const denied=await requireAdmin(req);if(denied)return denied;
 const from=process.env.OUTREACH_EMAIL_FROM||process.env.EMAIL_FROM||process.env.RESEND_FROM_EMAIL||"";
 const configured=Boolean(process.env.RESEND_API_KEY&&from&&!/@resend\.dev\b/i.test(from));
 return Response.json({from,configured,reason:configured?"":!from?"Gönderici e-postası tanımlanmamış.":/@resend\.dev\b/i.test(from)?"Resend test göndericisi dış müşterilere gönderim için uygun değil; doğrulanmış alan adı gerekli.":"E-posta sağlayıcısı yapılandırılmamış."},{headers:{"cache-control":"no-store"}});
}
export async function POST(req){
 const denied=await requireAdmin(req);if(denied)return denied;const originError=enforceSameOrigin(req);if(originError)return originError;
 try{
  const {prospectId,draft}=await req.json();if(!prospectId)return Response.json({error:"Aday gerekli."},{status:400});
  if(draft!==undefined&&(typeof draft!=="string"||draft.trim().length<30||draft.length>6000))return Response.json({error:"Mesaj 30–6000 karakter olmalı."},{status:400});
  const x=await getCommunicationProspect(prospectId);if(!x)return Response.json({error:"Aday bulunamadı."},{status:404});
  if(x.communicationStatus!=="ready-for-review"||x.contactStatus!=="verified"||!x.contactEmail)return Response.json({error:"Gönderim güvenlik koşulları sağlanmıyor."},{status:409});
  const sender=process.env.OUTREACH_EMAIL_FROM||process.env.EMAIL_FROM||process.env.RESEND_FROM_EMAIL||"";
  if(/@resend\.dev\b/i.test(sender))return Response.json({error:"Doğrulanmış kurumsal gönderici alan adı gerekli."},{status:409});
  let row;const sent=await sendBrandedOutreach({...x,...(draft!==undefined?{outreachDraft:draft.trim()}:{})},{key:`prospect-first/${x.id}`,finalize:async id=>{row=await markProspectCommunicationSent(x.id,id)}});
  return Response.json({ok:true,delivery:sent,prospect:row});
 }catch(e){return Response.json({error:"E-posta gönderilemedi.",detail:String(e?.message||e).slice(0,180)},{status:500})}
}
