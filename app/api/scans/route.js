import {completeScan,createScan,failScan,getClient,listScans} from "../../../lib/repository";
import {getClientProfile} from "../../../lib/client-profile";
import {runLocalizedProviderChecks,resolveRequestLanguage} from "../../../lib/localized-ai";
import {syncFindingsFromScan} from "../../../lib/findings";
import {requireAdmin,enforceSameOrigin} from "../../../lib/api-security";

export async function GET(req){
  const denied=await requireAdmin(req);if(denied)return denied;
  try{return Response.json({scans:await listScans(),mode:process.env.DATABASE_URL||process.env.STORAGE_URL?"database":"demo-only"});}
  catch{return Response.json({error:"Taramalar okunamadı."},{status:503});}
}

export async function POST(req){
  const denied=await requireAdmin(req);if(denied)return denied;
  const originError=enforceSameOrigin(req);if(originError)return originError;
  let stage="request",scanId="",language="tr";
  try{
    const body=await req.json();
    language=resolveRequestLanguage(req,body);
    const en=language==="en";
    if(!body?.clientId)return Response.json({error:en?"Please select a client.":"Bir müşteri seçmelisiniz.",stage},{status:400});

    stage="client";
    const client=await getClient(body.clientId);
    if(!client)return Response.json({error:en?"Client not found.":"Müşteri bulunamadı.",stage},{status:404});
    const profile=await getClientProfile(body.clientId).catch(()=>null);

    stage="scan-create";
    const scan=await createScan(body.clientId,body.queries||[]); scanId=scan?.id||"";
    if(!scan.persisted)return Response.json({scan,live:false,stage,language,note:en?"The scan could not be stored persistently because the database is unavailable.":"Veritabanı bağlı olmadığı için tarama kalıcı kaydedilemedi."},{status:202});

    stage="ai-provider";
    const providerRun=await runLocalizedProviderChecks({name:client.name,domain:client.domain,sector:profile?.sector||"",city:profile?.city||"",country:profile?.country||"",queries:Array.isArray(body.queries)?body.queries:[]},language);

    if(!providerRun.results.length)return Response.json({scan:{...scan,status:"awaiting-provider"},live:false,stage,language,providerErrors:providerRun.errors,note:en?"The scan was saved, but no response was received from the connected AI providers.":"Tarama kaydedildi ancak bağlı AI sağlayıcılarından yanıt alınamadı."},{status:202});

    stage="scan-complete";
    const completed=await completeScan(scan.id,providerRun.results);
    stage="findings-sync";
    const findings=await syncFindingsFromScan(body.clientId,completed).catch(()=>[]);
    return Response.json({scan:{...completed,clientName:client.name},live:true,language,provider:providerRun.results.map(x=>x.provider).join(" + "),providers:providerRun.results.map(x=>({name:x.provider,score:x.score})),providerErrors:providerRun.errors,findingsCreated:findings.length,context:{sector:profile?.sector||"",city:profile?.city||"",country:profile?.country||""},stage:"done"},{status:200});
  }catch(e){
    const detail=(e?.message||(language==="en"?"Unknown error":"Bilinmeyen hata")).slice(0,500);
    if(scanId){try{await failScan(scanId,`${stage}: ${detail}`)}catch{}}
    const message=e?.code==="23503"?(language==="en"?"Please select a valid client.":"Geçerli bir müşteri seçilmelidir."):(language==="en"?"The scan could not be completed.":"Tarama tamamlanamadı.");
    return Response.json({error:message,stage,detail},{status:e?.code==="23503"?400:500});
  }
}
