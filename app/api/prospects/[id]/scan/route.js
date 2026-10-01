import {completeProspectScan,getProspect,queueProspectScan} from "../../../../../lib/prospects";
import {runProviderCheck} from "../../../../../lib/providers";

export async function POST(req,{params}){
  try{
    const {id}=await params;
    const prospect=await getProspect(id);
    if(!prospect)return Response.json({error:"Aday bulunamadı."},{status:404});

    const scan=await queueProspectScan(id);
    const result=await runProviderCheck(prospect);

    if(!result){
      return Response.json({
        scan,
        mode:scan.status==="demo-only"?"demo-only":"database",
        live:false,
        note:"Tarama kuyruğa kaydedildi. Canlı AI sağlayıcı anahtarı bağlandığında analiz otomatik tamamlanacak."
      },{status:202});
    }

    const completed=await completeProspectScan(scan.id,id,result);
    return Response.json({scan:completed,live:true,provider:result.provider},{status:200});
  }catch(e){
    if(e?.code==="P404")return Response.json({error:"Aday bulunamadı."},{status:404});
    return Response.json({error:"AI taraması tamamlanamadı.",detail:process.env.NODE_ENV==="development"?e.message:undefined},{status:500});
  }
}