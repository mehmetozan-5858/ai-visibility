import {getLatestCompletedScan} from "../../../lib/repository";
import {runLocalizedContentPlan,resolveRequestLanguage} from "../../../lib/localized-ai";
import {requireAdmin,enforceSameOrigin,checkRateLimit} from "../../../lib/api-security";

export async function POST(req){
  const denied=await requireAdmin(req);if(denied)return denied;
  const origin=enforceSameOrigin(req);if(origin)return origin;
  const limited=checkRateLimit(req,{bucket:"content-agent",limit:20,windowMs:10*60*1000});if(limited)return limited;
  let language="tr";
  try{
    const body=await req.json();
    language=resolveRequestLanguage(req,body);
    const en=language==="en";
    if(!body?.clientId)return Response.json({error:en?"Please select a client.":"Bir müşteri seçmelisiniz."},{status:400});
    const scan=await getLatestCompletedScan(body.clientId);
    if(!scan)return Response.json({error:en?"No completed scan was found for this client.":"Bu müşteri için tamamlanmış tarama bulunamadı."},{status:404});
    const results=Array.isArray(scan.results)?scan.results:[];
    const plan=await runLocalizedContentPlan({clientName:scan.clientName,score:scan.score,summary:results.map(x=>x.provider+": "+(x.summary||"")).filter(Boolean).join("\n"),findings:results.flatMap(x=>(x.findings||[]).map(v=>x.provider+": "+v)),recommendations:results.flatMap(x=>(x.recommendations||[]).map(v=>x.provider+": "+v))},language);
    return Response.json({plan,scanId:scan.id,clientName:scan.clientName,language});
  }catch(e){
    return Response.json({error:language==="en"?"Content plan could not be generated.":"İçerik planı üretilemedi.",detail:(e?.message||(language==="en"?"Unknown error":"Bilinmeyen hata")).slice(0,300)},{status:500});
  }
}
