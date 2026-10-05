import {requireAdmin,enforceSameOrigin} from "../../../lib/api-security";
import {getCommunicationProspect,markProspectCommunicationSent} from "../../../lib/prospects";
import {sendBrandedOutreach} from "../../../lib/outreach-email";
export const runtime="nodejs";
export async function POST(req){
 const denied=await requireAdmin(req);if(denied)return denied;const originError=enforceSameOrigin(req);if(originError)return originError;
 try{
  const {prospectId}=await req.json();if(!prospectId)return Response.json({error:"Aday gerekli."},{status:400});
  const x=await getCommunicationProspect(prospectId);if(!x)return Response.json({error:"Aday bulunamadı."},{status:404});
  if(x.communicationStatus!=="ready-for-review"||x.contactStatus!=="verified"||!x.contactEmail)return Response.json({error:"Gönderim güvenlik koşulları sağlanmıyor."},{status:409});
  const sent=await sendBrandedOutreach(x);const row=await markProspectCommunicationSent(x.id,sent.id);
  return Response.json({ok:true,delivery:sent,prospect:row});
 }catch(e){return Response.json({error:"E-posta gönderilemedi.",detail:String(e?.message||e).slice(0,180)},{status:500})}
}
