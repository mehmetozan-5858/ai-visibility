import {getSalesCandidates,upsertSalesOpportunity} from "../../../lib/repository";
import {createPaymentAccessToken} from "../../../lib/admin-auth";

export async function GET(){
  try{
    const candidates=await getSalesCandidates(20);
    return Response.json({candidates});
  }catch(e){
    return Response.json({error:"Satış fırsatları okunamadı.",detail:String(e?.message||e).slice(0,250)},{status:500});
  }
}

function buildOffer(c){
  const score=Number(c.score)||0;
  const priority=score<=30?"yüksek":score<=55?"orta":"düşük";
  const results=Array.isArray(c.results)?c.results:[];
  const providerLine=results.length
    ? results.map(x=>`${x.provider||"AI"} ${x.score??"-"}/100`).join(" · ")
    : `Genel skor ${score}/100`;

  const findings=results.flatMap(x=>Array.isArray(x.findings)?x.findings:[]).filter(Boolean);
  const recs=results.flatMap(x=>Array.isArray(x.recommendations)?x.recommendations:[]).filter(Boolean);

  const setup=priority==="yüksek"?"7.500–12.500 TL":priority==="orta"?"5.000–10.000 TL":"5.000–7.500 TL";
  const monthly=priority==="yüksek"?"4.500–7.500 TL/ay":priority==="orta"?"3.500–6.000 TL/ay":"2.500–4.500 TL/ay";

  const whyNow=[
    `Son AI görünürlük skoru ${score}/100. ${providerLine}`,
    findings[0]||"AI görünürlüğünü artırmak için doğrulanabilir iyileştirme alanları bulunuyor.",
    recs[0]||"GEO/AEO içerik ve yapılandırılmış veri iyileştirmeleriyle ölçülebilir takip yapılabilir."
  ];

  return {
    priority,
    whyNow,
    offer:{
      name:priority==="yüksek"?"AI Görünürlük Hızlı İyileştirme Paketi":"AI Görünürlük Başlangıç Paketi",
      setupPriceRange:setup,
      monthlyPriceRange:monthly,
      scope:[
        "ChatGPT + Gemini + Perplexity görünürlük takibi",
        "GEO/AEO teknik ve içerik iyileştirme planı",
        "Aylık karşılaştırmalı görünürlük raporu",
        "İçerik önerileri ve öncelikli aksiyon listesi"
      ]
    },
    outreachDraft:`Merhaba, ${c.name} için ChatGPT, Gemini ve Perplexity üzerinde kısa bir AI görünürlük kontrolü yaptık. Genel skorunuz ${score}/100 çıktı. İsterseniz hangi alanlarda görünürlüğün geliştirilebileceğini gösteren ücretsiz kısa özeti paylaşabilirim.`,
    fallback:false,
    instant:true
  };
}

export async function POST(req){
  try{
    const body=await req.json();
    const candidates=await getSalesCandidates(50);
    const c=candidates.find(x=>x.id===body?.clientId);
    if(!c)return Response.json({error:"Müşteri için tamamlanmış tarama bulunamadı."},{status:404});
    const offer=buildOffer(c);
    const priority=offer.priority==="yüksek"?"high":offer.priority==="orta"?"medium":"low";
    await upsertSalesOpportunity(c.id,{priority});
    const paymentToken=await createPaymentAccessToken(c.id);
    return Response.json({client:c,offer,paymentUrl:"/odeme?token="+encodeURIComponent(paymentToken)});
  }catch(e){
    return Response.json({error:"Satış teklifi hazırlanamadı.",detail:String(e?.message||e).slice(0,250)},{status:500});
  }
}
