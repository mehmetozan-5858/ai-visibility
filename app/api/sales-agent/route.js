import {getSalesCandidates} from "../../../lib/repository";
import {runSalesOffer} from "../../../lib/providers";

export async function GET(){
  try{
    const candidates=await getSalesCandidates(20);
    return Response.json({candidates});
  }catch(e){
    return Response.json({error:"Satış fırsatları okunamadı.",detail:String(e?.message||e).slice(0,250)},{status:500});
  }
}

export async function POST(req){
  try{
    const body=await req.json();
    const candidates=await getSalesCandidates(50);
    const c=candidates.find(x=>x.id===body?.clientId);
    if(!c)return Response.json({error:"Müşteri için tamamlanmış tarama bulunamadı."},{status:404});
    const offer=await runSalesOffer({
      clientName:c.name,
      domain:c.domain,
      score:c.score,
      results:Array.isArray(c.results)?c.results:[]
    });
    return Response.json({client:c,offer});
  }catch(e){
    return Response.json({error:"Satış teklifi hazırlanamadı.",detail:String(e?.message||e).slice(0,250)},{status:500});
  }
}
