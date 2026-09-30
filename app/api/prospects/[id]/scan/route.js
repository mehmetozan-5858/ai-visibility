import {queueProspectScan} from "../../../../../lib/prospects";
export async function POST(req,{params}){
  try{
    const {id}=await params;
    const scan=await queueProspectScan(id);
    return Response.json({
      scan,
      mode:scan.status==="demo-only"?"demo-only":"database",
      note:"Tarama kaydı oluşturuldu. Canlı AI sağlayıcısı bağlanınca analiz otomatik tamamlanacak."
    },{status:202});
  }catch(e){
    if(e?.code==="P404")return Response.json({error:"Aday bulunamadı."},{status:404});
    return Response.json({error:"Tarama kuyruğa alınamadı."},{status:500});
  }
}