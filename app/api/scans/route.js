import {completeScan,createScan,getClient,listScans} from "../../../lib/repository";
import {runProviderCheck} from "../../../lib/providers";

export async function GET(){
  try{return Response.json({scans:await listScans(),mode:process.env.DATABASE_URL||process.env.STORAGE_URL?"database":"demo-only"});}
  catch(e){return Response.json({error:"Taramalar okunamadı."},{status:503});}
}

export async function POST(req){
  try{
    const body=await req.json();
    if(!body?.clientId)return Response.json({error:"Bir müşteri seçmelisiniz."},{status:400});
    const client=await getClient(body.clientId);
    if(!client)return Response.json({error:"Müşteri bulunamadı."},{status:404});

    const scan=await createScan(body.clientId,body.queries||[]);
    if(!scan.persisted){
      return Response.json({scan,live:false,note:"Veritabanı bağlı olmadığı için tarama kalıcı kaydedilemedi."},{status:202});
    }

    const result=await runProviderCheck({
      name:client.name,
      domain:client.domain,
      sector:client.plan||"",
      city:"",
      queries:Array.isArray(body.queries)?body.queries:[]
    });

    if(!result){
      return Response.json({
        scan:{...scan,status:"awaiting-provider"},
        live:false,
        note:"Tarama kaydedildi. En az bir canlı AI sağlayıcı anahtarı gerekli."
      },{status:202});
    }

    const completed=await completeScan(scan.id,result);
    return Response.json({scan:{...completed,clientName:client.name},live:true,provider:result.provider},{status:200});
  }catch(e){
    const message=e?.code==="23503"?"Geçerli bir müşteri seçilmelidir.":"Tarama tamamlanamadı.";
    return Response.json({error:message,detail:process.env.NODE_ENV==="development"?e.message:undefined},{status:e?.code==="23503"?400:500});
  }
}
