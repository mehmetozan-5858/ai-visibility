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
    let offer;
    try{
      offer=await runSalesOffer({
        clientName:c.name,
        domain:c.domain,
        score:c.score,
        results:Array.isArray(c.results)?c.results:[]
      });
    }catch(e){
      const score=Number(c.score)||0;
      const priority=score<=30?"yüksek":score<=55?"orta":"düşük";
      const setup=priority==="yüksek"?"7.500–12.500 TL":priority==="orta"?"5.000–10.000 TL":"5.000–7.500 TL";
      const monthly=priority==="yüksek"?"4.500–7.500 TL/ay":priority==="orta"?"3.500–6.000 TL/ay":"2.500–4.500 TL/ay";
      offer={
        priority,
        whyNow:[
          `Son AI görünürlük skoru ${score}/100.`,
          "ChatGPT, Gemini ve Perplexity sonuçlarındaki eksikler üzerinden ölçülebilir iyileştirme yapılabilir."
        ],
        offer:{
          name:"AI Görünürlük Başlangıç Paketi",
          setupPriceRange:setup,
          monthlyPriceRange:monthly,
          scope:[
            "ChatGPT + Gemini + Perplexity görünürlük takibi",
            "GEO/AEO iyileştirme planı",
            "Aylık karşılaştırmalı rapor",
            "İçerik önerileri ve hızlı kazanımlar"
          ]
        },
        outreachDraft:`Merhaba, ${c.name} için ChatGPT, Gemini ve Perplexity üzerinde kısa bir AI görünürlük kontrolü yaptık. Genel skorunuz ${score}/100 çıktı. İsterseniz hangi alanlarda görünürlüğün geliştirilebileceğini gösteren ücretsiz kısa özeti paylaşabilirim.`,
        fallback:true
      };
    }
    return Response.json({client:c,offer});
  }catch(e){
    return Response.json({error:"Satış teklifi hazırlanamadı.",detail:String(e?.message||e).slice(0,250)},{status:500});
  }
}
