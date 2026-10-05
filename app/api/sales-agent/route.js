import {getSalesCandidates,upsertSalesOpportunity} from "../../../lib/repository";
import {getClientProfile} from "../../../lib/client-profile";
import {createPaymentAccessToken} from "../../../lib/admin-auth";
import {requireAdmin,enforceSameOrigin} from "../../../lib/api-security";
import {servicePrice,formatMoney} from "../../../lib/regional-pricing";

export async function GET(req){
  const denied=await requireAdmin(req);if(denied)return denied;
  try{
    const candidates=await getSalesCandidates(20);
    return Response.json({candidates});
  }catch(e){
    return Response.json({error:"Satış fırsatları okunamadı.",detail:String(e?.message||e).slice(0,250)},{status:500});
  }
}

function money(p){
  const locale=p.currency==="TRY"?"tr-TR":p.currency==="GBP"?"en-GB":p.currency==="EUR"?"en-IE":"en-US";
  return formatMoney(p.amount,p.currency,locale);
}

function buildOffer(c,country="Türkiye"){
  const score=Number(c.score)||0;
  const priority=score<=30?"yüksek":score<=55?"orta":"düşük";
  const opportunityScore=Math.max(0,Math.min(100,100-score));
  const results=Array.isArray(c.results)?c.results:[];
  const providerLine=results.length?results.map(x=>`${x.provider||"AI"} ${x.score??"-"}/100`).join(" · "):`Genel skor ${score}/100`;
  const findings=results.flatMap(x=>Array.isArray(x.findings)?x.findings:[]).filter(Boolean);
  const recs=results.flatMap(x=>Array.isArray(x.recommendations)?x.recommendations:[]).filter(Boolean);
  const diagnosis=servicePrice({service:"business-diagnosis",country,language:"tr"});
  const solution=servicePrice({service:"business-solution",country,language:"tr"});
  const monitoring=servicePrice({service:"business-monitoring",country,language:"tr"});

  return {
    priority,opportunityScore,
    opportunityType:score<60?"AI görünürlük iyileştirme":"Sürekli optimizasyon",
    whyNow:[
      `Son AI görünürlük skoru ${score}/100. ${providerLine}`,
      findings[0]||"AI görünürlüğünü artırmak için doğrulanabilir iyileştirme alanları bulunuyor.",
      recs[0]||"GEO/AEO içerik ve yapılandırılmış veri iyileştirmeleriyle ölçülebilir takip yapılabilir."
    ],
    offer:{
      name:"AI Visibility – Tespit, Çözüm ve Sürekli Optimizasyon",
      setupPriceRange:`Sorun tespiti + rapor: ${money(diagnosis)} · Çözüm: ${money(solution)}'dan`,
      monthlyPriceRange:`Sürekli takip + optimizasyon: ${money(monitoring)}/ay`,
      currency:diagnosis.currency,
      country,
      diagnosis:{code:diagnosis.code,amount:diagnosis.amount,display:money(diagnosis)},
      solution:{code:solution.code,amount:solution.amount,display:money(solution)},
      monitoring:{code:monitoring.code,amount:monitoring.amount,display:money(monitoring)},
      scope:[
        "ChatGPT + Gemini + Perplexity görünürlük takibi",
        "Sorun tespit ve profesyonel raporlama",
        "GEO/AEO teknik ve içerik çözüm planı",
        "Onay sonrası çözüm / uygulama görevleri",
        "Aylık karşılaştırmalı görünürlük ve optimizasyon"
      ]
    },
    outreachDraft:`Merhaba, ${c.name} için ChatGPT, Gemini ve Perplexity üzerinde kısa bir AI görünürlük kontrolü yaptık. Genel skorunuz ${score}/100 çıktı. İsterseniz önce sorunları ve fırsatları netleştiren profesyonel analiz raporuyla başlayabiliriz.`,
    fallback:false,
    instant:true
  };
}

export async function POST(req){
  const denied=await requireAdmin(req);if(denied)return denied;
  const originError=enforceSameOrigin(req);if(originError)return originError;
  try{
    const body=await req.json();
    const candidates=await getSalesCandidates(50);
    const c=candidates.find(x=>x.id===body?.clientId);
    if(!c)return Response.json({error:"Müşteri için tamamlanmış tarama bulunamadı."},{status:404});
    const profile=await getClientProfile(c.id).catch(()=>null);
    const country=String(profile?.country||"Türkiye").trim();
    const offer=buildOffer(c,country);
    const priority=offer.priority==="yüksek"?"high":offer.priority==="orta"?"medium":"low";
    await upsertSalesOpportunity(c.id,{priority});
    const service=offer.offer?.diagnosis?.code||"business-diagnosis";
    const paymentToken=await createPaymentAccessToken(c.id,604800,service);
    return Response.json({client:c,offer,paymentUrl:"/odeme?token="+encodeURIComponent(paymentToken)+"&service="+encodeURIComponent(service)});
  }catch(e){
    return Response.json({error:"Satış teklifi hazırlanamadı.",detail:String(e?.message||e).slice(0,250)},{status:500});
  }
}
