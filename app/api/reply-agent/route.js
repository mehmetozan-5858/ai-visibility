import {requireAdmin,enforceSameOrigin} from "../../../lib/api-security";
import {getCommunicationProspect,saveProspectReplyAnalysis} from "../../../lib/prospects";
import {analyzeSalesReply} from "../../../lib/providers";
export const runtime="nodejs";
export async function POST(req){
 const denied=await requireAdmin(req);if(denied)return denied;const originError=enforceSameOrigin(req);if(originError)return originError;
 try{
  const body=await req.json(),replyText=String(body?.replyText||"").trim();
  if(!body?.prospectId||!replyText)return Response.json({error:"Aday ve müşteri cevabı gerekli."},{status:400});
  const x=await getCommunicationProspect(body.prospectId);if(!x)return Response.json({error:"Aday bulunamadı."},{status:404});
  const analysis=await analyzeSalesReply({...x,replyText});const saved=await saveProspectReplyAnalysis(x.id,analysis);
  return Response.json({ok:true,analysis,saved});
 }catch(e){return Response.json({error:"Cevap analiz edilemedi.",detail:String(e?.message||e).slice(0,180)},{status:500})}
}
