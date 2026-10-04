import {cookies} from "next/headers";
import {verifyClientToken} from "../../../../lib/admin-auth";
import {listFindingsForClient,requestSolution,syncFindingsFromScan} from "../../../../lib/findings";
import {getLatestCompletedScan} from "../../../../lib/repository";

export async function GET(){
  try{
    const store=await cookies();
    const session=await verifyClientToken(store.get("ai_client")?.value||"");
    if(!session)return Response.json({error:"Müşteri oturumu geçersiz."},{status:401});
    let findings=await listFindingsForClient(session.clientId);
    if(!findings.length){
      const latest=await getLatestCompletedScan(session.clientId);
      if(latest?.id){
        await syncFindingsFromScan(session.clientId,latest);
        findings=await listFindingsForClient(session.clientId);
      }
    }
    return Response.json({findings});
  }catch{return Response.json({error:"Çözüm kayıtları yüklenemedi."},{status:500})}
}

export async function POST(req){
  try{
    const store=await cookies();
    const session=await verifyClientToken(store.get("ai_client")?.value||"");
    if(!session)return Response.json({error:"Müşteri oturumu geçersiz."},{status:401});
    const body=await req.json();
    const findingId=String(body?.findingId||"").trim();
    if(!findingId)return Response.json({error:"Bulgu seçilmedi."},{status:400});
    const result=await requestSolution(session.clientId,findingId);
    if(!result)return Response.json({error:"Bulgu bulunamadı."},{status:404});
    return Response.json({ok:true,result,message:"Çözüm talebiniz alındı. Fiyat ve uygulama adımı panelinize yansıtılacak."});
  }catch{return Response.json({error:"Çözüm talebi alınamadı."},{status:500})}
}
