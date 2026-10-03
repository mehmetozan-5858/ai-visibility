import {completeScan,createScan,failScan,getClient,listScans} from "../../../lib/repository";
import {getClientProfile} from "../../../lib/client-profile";
import {runProviderChecks} from "../../../lib/providers";
import {syncFindingsFromScan} from "../../../lib/findings";

export async function GET(){
  try{return Response.json({scans:await listScans(),mode:process.env.DATABASE_URL||process.env.STORAGE_URL?"database":"demo-only"});}
  catch(e){return Response.json({error:"Taramalar okunamadı."},{status:503});}
}

export async function POST(req){
  let stage="request",scanId="";
  try{
    const body=await req.json();
    if(!body?.clientId)return Response.json({error:"Bir müşteri seçmelisiniz.",stage},{status:400});

    stage="client";
    const client=await getClient(body.clientId);
    if(!client)return Response.json({error:"Müşteri bulunamadı.",stage},{status:404});
    const profile=await getClientProfile(body.clientId).catch(()=>null);

    stage="scan-create";
    const scan=await createScan(body.clientId,body.queries||[]); scanId=scan?.id||"";
    if(!scan.persisted){
      return Response.json({scan,live:false,stage,note:"Veritabanı bağlı olmadığı için tarama kalıcı kaydedilemedi."},{status:202});
    }

    stage="ai-provider";
    const providerRun=await runProviderChecks({
      name:client.name,
      domain:client.domain,
      sector:profile?.sector||"",
      city:profile?.city||"",
      country:profile?.country||"",
      queries:Array.isArray(body.queries)?body.queries:[]
    });

    if(!providerRun.results.length){
      return Response.json({
        scan:{...scan,status:"awaiting-provider"},
        live:false,
        stage,
        providerErrors:providerRun.errors,
        note:"Tarama kaydedildi ancak bağlı AI sağlayıcılarından yanıt alınamadı."
      },{status:202});
    }

    stage="scan-complete";
    const completed=await completeScan(scan.id,providerRun.results);
    stage="findings-sync";
    const findings=await syncFindingsFromScan(body.clientId,completed).catch(()=>[]);
    return Response.json({
      scan:{...completed,clientName:client.name},
      live:true,
      provider:providerRun.results.map(x=>x.provider).join(" + "),
      providers:providerRun.results.map(x=>({name:x.provider,score:x.score})),
      providerErrors:providerRun.errors,
      findingsCreated:findings.length,
      context:{sector:profile?.sector||"",city:profile?.city||"",country:profile?.country||""},
      stage:"done"
    },{status:200});
  }catch(e){
    const detail=(e?.message||"Bilinmeyen hata").slice(0,500);
    if(scanId){
      try{await failScan(scanId,`${stage}: ${detail}`)}catch{}
    }
    const message=e?.code==="23503"?"Geçerli bir müşteri seçilmelidir.":"Tarama tamamlanamadı.";
    return Response.json({
      error:message,
      stage,
      detail
    },{status:e?.code==="23503"?400:500});
  }
}
