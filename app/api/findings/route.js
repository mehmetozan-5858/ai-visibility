import {getLatestCompletedScan} from "../../../lib/repository";
import {listFindings,syncFindingsFromScan,updateFindingOffer} from "../../../lib/findings";

export async function GET(){
  try{return Response.json({findings:await listFindings()})}
  catch(e){return Response.json({error:"Bulgular okunamadı.",detail:e?.message||""},{status:500})}
}
export async function POST(req){
  try{
    const body=await req.json();const clientId=body?.clientId;
    if(!clientId)return Response.json({error:"Müşteri seçmelisiniz."},{status:400});
    const scan=await getLatestCompletedScan(clientId);
    if(!scan)return Response.json({error:"Tamamlanmış tarama bulunamadı."},{status:404});
    const findings=await syncFindingsFromScan(clientId,scan);
    return Response.json({ok:true,count:findings.length,findings});
  }catch(e){return Response.json({error:"Bulgular üretilemedi.",detail:e?.message||""},{status:500})}
}
export async function PATCH(req){
  try{const body=await req.json();await updateFindingOffer(body||{});return Response.json({ok:true})}
  catch(e){return Response.json({error:"Bulgu güncellenemedi.",detail:e?.message||""},{status:500})}
}
