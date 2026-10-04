import {cookies} from "next/headers";
import {verifyClientToken} from "../../../../lib/admin-auth";
import {listFindingsForClient,requestSolution,syncFindingsFromScan} from "../../../../lib/findings";
import {getLatestCompletedScan} from "../../../../lib/repository";
import {resolveRequestLanguage} from "../../../../lib/localized-ai";
import {enforceSameOrigin,checkRateLimit} from "../../../../lib/api-security";

export async function GET(req){
  const language=resolveRequestLanguage(req,{}),en=language==="en";
  try{
    const store=await cookies();
    const session=await verifyClientToken(store.get("ai_client")?.value||"");
    if(!session)return Response.json({error:en?"Your customer session is invalid.":"Müşteri oturumu geçersiz."},{status:401});
    let findings=await listFindingsForClient(session.clientId);
    if(!findings.length){
      const latest=await getLatestCompletedScan(session.clientId);
      if(latest?.id){await syncFindingsFromScan(session.clientId,latest);findings=await listFindingsForClient(session.clientId);}
    }
    return Response.json({findings,language});
  }catch{return Response.json({error:en?"Solution records could not be loaded.":"Çözüm kayıtları yüklenemedi."},{status:500})}
}

export async function POST(req){
  const origin=enforceSameOrigin(req);if(origin)return origin;
  const limited=checkRateLimit(req,{bucket:"client-solution-request",limit:20,windowMs:10*60*1000});if(limited)return limited;
  let language="tr";
  try{
    const store=await cookies();
    const session=await verifyClientToken(store.get("ai_client")?.value||"");
    const body=await req.json();language=resolveRequestLanguage(req,body);const en=language==="en";
    if(!session)return Response.json({error:en?"Your customer session is invalid.":"Müşteri oturumu geçersiz."},{status:401});
    const findingId=String(body?.findingId||"").trim();
    if(!findingId)return Response.json({error:en?"No finding was selected.":"Bulgu seçilmedi."},{status:400});
    const result=await requestSolution(session.clientId,findingId);
    if(!result)return Response.json({error:en?"Finding not found.":"Bulgu bulunamadı."},{status:404});
    return Response.json({ok:true,result,language,message:en?"Your solution request has been received. Pricing and the implementation step will appear in your portal.":"Çözüm talebiniz alındı. Fiyat ve uygulama adımı panelinize yansıtılacak."});
  }catch{return Response.json({error:language==="en"?"Your solution request could not be processed.":"Çözüm talebi alınamadı."},{status:500})}
}
