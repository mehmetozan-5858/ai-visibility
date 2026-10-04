import {getClient,getLatestCompletedScan,saveImplementationWorkItems} from "../../../lib/repository";
import {runLocalizedImplementationPlan,resolveRequestLanguage} from "../../../lib/localized-ai";
import {requireAdmin,enforceSameOrigin,checkRateLimit} from "../../../lib/api-security";

export async function POST(req){
  const denied=await requireAdmin(req);if(denied)return denied;
  const origin=enforceSameOrigin(req);if(origin)return origin;
  const limited=checkRateLimit(req,{bucket:"implementation-agent",limit:20,windowMs:10*60*1000});if(limited)return limited;
  let language="tr";
  try{
    const body=await req.json();
    language=resolveRequestLanguage(req,body);
    const en=language==="en";
    if(!body?.clientId)return Response.json({error:en?"Please select a client.":"Bir müşteri seçmelisiniz."},{status:400});
    const [client,scan]=await Promise.all([getClient(body.clientId),getLatestCompletedScan(body.clientId)]);
    if(!client)return Response.json({error:en?"Client not found.":"Müşteri bulunamadı."},{status:404});
    if(!scan)return Response.json({error:en?"No completed scan was found for this client.":"Bu müşteri için tamamlanmış tarama bulunamadı."},{status:404});
    const plan=await runLocalizedImplementationPlan({clientName:client.name,domain:client.domain,score:scan.score,results:Array.isArray(scan.results)?scan.results:[]},language);
    const workItems=await saveImplementationWorkItems(client.id,plan);
    return Response.json({client:{id:client.id,name:client.name,domain:client.domain},scanId:scan.id,plan,workItems,language});
  }catch(e){
    return Response.json({error:language==="en"?"Implementation package could not be prepared.":"Uygulama paketi hazırlanamadı.",detail:String(e?.message||e).slice(0,300)},{status:500});
  }
}
