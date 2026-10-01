import {getClient,getLatestCompletedScan,saveImplementationWorkItems} from "../../../lib/repository";
import {runImplementationPlan} from "../../../lib/providers";

export async function POST(req){
  try{
    const body=await req.json();
    if(!body?.clientId)return Response.json({error:"Bir müşteri seçmelisiniz."},{status:400});
    const [client,scan]=await Promise.all([getClient(body.clientId),getLatestCompletedScan(body.clientId)]);
    if(!client)return Response.json({error:"Müşteri bulunamadı."},{status:404});
    if(!scan)return Response.json({error:"Bu müşteri için tamamlanmış tarama bulunamadı."},{status:404});
    const plan=await runImplementationPlan({
      clientName:client.name,
      domain:client.domain,
      score:scan.score,
      results:Array.isArray(scan.results)?scan.results:[]
    });
    const workItems=await saveImplementationWorkItems(client.id,plan);
    return Response.json({client:{id:client.id,name:client.name,domain:client.domain},scanId:scan.id,plan,workItems});
  }catch(e){
    return Response.json({error:"Uygulama paketi hazırlanamadı.",detail:String(e?.message||e).slice(0,300)},{status:500});
  }
}
