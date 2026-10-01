import {getLatestCompletedScan} from "../../../lib/repository";
import {runContentPlan} from "../../../lib/providers";

export async function POST(req){
  try{
    const body=await req.json();
    if(!body?.clientId)return Response.json({error:"Bir müşteri seçmelisiniz."},{status:400});
    const scan=await getLatestCompletedScan(body.clientId);
    if(!scan)return Response.json({error:"Bu müşteri için tamamlanmış tarama bulunamadı."},{status:404});
    const result=Array.isArray(scan.results)?scan.results[0]||{}:{};
    const plan=await runContentPlan({
      clientName:scan.clientName,
      score:scan.score,
      summary:result.summary||"",
      findings:result.findings||[],
      recommendations:result.recommendations||[]
    });
    return Response.json({plan,scanId:scan.id,clientName:scan.clientName});
  }catch(e){
    return Response.json({error:"İçerik planı üretilemedi.",detail:(e?.message||"Bilinmeyen hata").slice(0,300)},{status:500});
  }
}
