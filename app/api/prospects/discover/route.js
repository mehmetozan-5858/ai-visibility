import {seedProspects,getProspectNames} from "../../../../lib/prospects";
import {discoverBusinesses} from "../../../../lib/providers";

export async function POST(req){
  try{
    let country="Türkiye",city="Sivas",sector="";
    try{
      const body=await req.json();
      if(body?.country)country=String(body.country).trim()||"Türkiye";
      if(body?.city)city=String(body.city).trim()||"Sivas";
      if(body?.sector)sector=String(body.sector).trim();
    }catch{}

    const existingNames=await getProspectNames();
    const found=await discoverBusinesses({country,city,sector,existingNames});
    if(!found.length){
      return Response.json({error:"Yeni ve doğrulanabilir aday bulunamadı. Daha sonra tekrar deneyin."},{status:404});
    }
    const prospects=await seedProspects(found);
    const newOnes=prospects.filter(x=>!existingNames.some(n=>n.toLocaleLowerCase("tr-TR")===x.name.toLocaleLowerCase("tr-TR")));
    return Response.json({
      prospects,
      count:prospects.length,
      newCount:newOnes.length,
      sectors:[...new Set(prospects.map(x=>x.sector).filter(Boolean))],
      country,
      city,
      sector,
      mode:process.env.DATABASE_URL?"database":"demo-only",
      discovery:"perplexity-web"
    });
  }catch(e){
    return Response.json({
      error:"Canlı aday keşfi yapılamadı.",
      detail:String(e?.message||e).slice(0,300)
    },{status:500});
  }
}
