import {getLatestCompletedScan} from "../../../lib/repository";
import {runContentPlan} from "../../../lib/providers";
import {requireAdmin,enforceSameOrigin,checkRateLimit} from "../../../lib/api-security";

export async function POST(req){
  const denied=await requireAdmin(req);if(denied)return denied;
  const origin=enforceSameOrigin(req);if(origin)return origin;
  const limited=checkRateLimit(req,{bucket:"content-agent",limit:20,windowMs:10*60*1000});if(limited)return limited;
  try{
    const body=await req.json();
    if(!body?.clientId)return Response.json({error:"Bir müşteri seçmelisiniz."},{status:400});
    const scan=await getLatestCompletedScan(body.clientId);
    if(!scan)return Response.json({error:"Bu müşteri için tamamlanmış tarama bulunamadı."},{status:404});
    const results=Array.isArray(scan.results)?scan.results:[];
    const plan=await runContentPlan({
      clientName:scan.clientName,
      score:scan.score,
      summary:results.map(x=>x.provider+": "+(x.summary||"")).filter(Boolean).join("\n"),
      findings:results.flatMap(x=>(x.findings||[]).map(v=>x.provider+": "+v)),
      recommendations:results.flatMap(x=>(x.recommendations||[]).map(v=>x.provider+": "+v))
    });
    return Response.json({plan,scanId:scan.id,clientName:scan.clientName});
  }catch(e){
    return Response.json({error:"İçerik planı üretilemedi.",detail:(e?.message||"Bilinmeyen hata").slice(0,300)},{status:500});
  }
}
