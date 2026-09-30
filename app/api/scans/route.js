import {createScan,listScans} from "../../../lib/repository";

export async function GET(){
  try{return Response.json({scans:await listScans(),mode:process.env.DATABASE_URL?"database":"demo-only"});}
  catch(e){return Response.json({error:"Taramalar okunamadı."},{status:503});}
}

export async function POST(req){
  try{
    const body=await req.json();
    if(!body?.clientId)return Response.json({error:"clientId required"},{status:400});
    const scan=await createScan(body.clientId,body.queries||[]);
    return Response.json({
      scan,
      mode:scan.persisted?"database":"demo-only",
      note:"Tarama kuyruğa kaydedildi; canlı AI sağlayıcıları ayrıca bağlanacak."
    },{status:202});
  }catch(e){
    const message=e?.code==="23503"?"Geçerli bir müşteri seçilmelidir.":"Tarama kaydedilemedi.";
    return Response.json({error:message},{status:e?.code==="23503"?400:500});
  }
}
