import {addClient,completeScan,createScan,findClientByIdentity} from "../../../../../lib/repository";
import {getProspect,markProspectConverted} from "../../../../../lib/prospects";
import {runProviderChecks} from "../../../../../lib/providers";

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

    const providerRun=await runProviderChecks({
      name:prospect.name,
      domain:prospect.domain||"",
      sector:prospect.sector||"",
      city:prospect.city||""
    });

    if(!providerRun.results.length){
      await markProspectConverted(id);
      return Response.json({
        client,scan:{...scan,status:"awaiting-provider"},live:false,
        providerErrors:providerRun.errors,
        note:"Müşteri oluşturuldu. Bağlı AI sağlayıcılarından yanıt alınamadı."
      },{status:202});
    }

    const completed=await completeScan(scan.id,providerRun.results);
    const avg=completed?.score??0;
    const reason=providerRun.results.map(x=>x.reason).filter(Boolean).join(" | ");
    await markProspectConverted(id,avg,reason);
    return Response.json({
      client,
      scan:{...completed,clientName:client.name},
      live:true,
      providers:providerRun.results.map(x=>({name:x.provider,score:x.score})),
      providerErrors:providerRun.errors
    },{status:200});
  }catch(e){
    return Response.json({
      error:"Müşteriye dönüştürme ve tarama tamamlanamadı.",
      detail:process.env.NODE_ENV==="development"?e.message:undefined
    },{status:500});
  }
}
