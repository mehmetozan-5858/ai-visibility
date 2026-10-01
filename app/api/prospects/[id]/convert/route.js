import {addClient,completeScan,createScan,findClientByIdentity} from "../../../../../lib/repository";
import {getProspect,markProspectConverted} from "../../../../../lib/prospects";
import {runProviderCheck} from "../../../../../lib/providers";

export async function POST(req,{params}){
  try{
    const {id}=await params;
    const prospect=await getProspect(id);
    if(!prospect)return Response.json({error:"Aday bulunamadı."},{status:404});

    let client=await findClientByIdentity(prospect.name,prospect.domain);
    if(!client){
      client=await addClient({
        name:prospect.name,
        domain:prospect.domain||"",
        plan:"Starter",
        competitors:[]
      });
    }
    if(!client?.persisted && !client?.createdAt){
      return Response.json({error:"Müşteri kaydı oluşturulamadı."},{status:500});
    }

    const scan=await createScan(client.id,[]);
    if(!scan.persisted){
      await markProspectConverted(id);
      return Response.json({
        client,scan,live:false,
        note:"Müşteri hazırlandı ancak veritabanı taraması kalıcı kaydedilemedi."
      },{status:202});
    }

    const result=await runProviderCheck({
      name:prospect.name,
      domain:prospect.domain||"",
      sector:prospect.sector||"",
      city:prospect.city||""
    });

    if(!result){
      await markProspectConverted(id);
      return Response.json({
        client,scan:{...scan,status:"awaiting-provider"},live:false,
        note:"Müşteri oluşturuldu. AI sağlayıcısı hazır olduğunda tarama tamamlanacak."
      },{status:202});
    }

    const completed=await completeScan(scan.id,result);
    await markProspectConverted(id,result.score,result.reason||"");
    return Response.json({
      client,
      scan:{...completed,clientName:client.name},
      live:true,
      provider:result.provider
    },{status:200});
  }catch(e){
    return Response.json({
      error:"Müşteriye dönüştürme ve tarama tamamlanamadı.",
      detail:process.env.NODE_ENV==="development"?e.message:undefined
    },{status:500});
  }
}
