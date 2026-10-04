export const creatorPlatforms=[
  {id:"youtube",name:"YouTube",focus:["kanal görünürlüğü","başlık/açıklama/etiket","izlenme ve tutma","niş ve konu boşlukları","gelir potansiyeli"]},
  {id:"instagram",name:"Instagram",focus:["profil keşfedilebilirliği","Reels performansı","içerik sütunları","etkileşim","kitle büyümesi"]},
  {id:"tiktok",name:"TikTok",focus:["trend uyumu","ilk 3 saniye","izlenme tamamlama","seri içerik","keşfet sinyalleri"]},
  {id:"x",name:"X / Twitter",focus:["konu otoritesi","thread performansı","etkileşim ağı","gündem fırsatları","takipçi kalitesi"]},
  {id:"linkedin",name:"LinkedIn",focus:["uzmanlık otoritesi","profil SEO","B2B erişim","içerik dağıtımı","lead potansiyeli"]},
  {id:"facebook",name:"Facebook",focus:["sayfa görünürlüğü","video/reels","topluluk","yerel erişim","yeniden hedefleme sinyalleri"]}
];

export const creatorAgentDesks=[
  {
    id:"intelligence",
    title:"Creator Intelligence Masası",
    phase:"Rapor öncesi",
    agents:[
      {name:"Platform Scout",job:"Hesapları ve platform sinyallerini toplar."},
      {name:"Niche Radar",job:"Niş, konu ve büyüme boşluklarını bulur."},
      {name:"Audience Analyst",job:"Kitle, etkileşim ve izleyici kalitesini analiz eder."},
      {name:"Competitor Creator Radar",job:"Benzer creator hesaplarını ve formatlarını karşılaştırır."}
    ]
  },
  {
    id:"diagnosis",
    title:"Sorun Tespit Masası",
    phase:"Rapor",
    agents:[
      {name:"Visibility Diagnostician",job:"Keşfedilebilirlik ve görünürlük sorunlarını sınıflandırır."},
      {name:"Content Auditor",job:"Başlık, açıklama, format, seri ve yayın yapısını inceler."},
      {name:"Retention Analyst",job:"İzlenme, tutma ve ilk temas sorunlarını önceliklendirir."},
      {name:"Monetization Analyst",job:"Gelir yolları ve ticari potansiyel kayıplarını belirler."}
    ]
  },
  {
    id:"solution",
    title:"Çözüm Ajanları Masası",
    phase:"Rapor sonrası",
    agents:[
      {name:"Content Strategist",job:"Sorunlara göre içerik planı ve konu kümeleri üretir."},
      {name:"SEO & Discovery Agent",job:"Platform içi arama, anahtar kelime ve keşif optimizasyonu yapar."},
      {name:"Hook & Retention Agent",job:"Hook, giriş, akış ve izlenme tutma iyileştirmeleri üretir."},
      {name:"Profile Optimizer",job:"Bio, profil, kanal sayfası ve CTA alanlarını optimize eder."},
      {name:"Growth Experiment Agent",job:"A/B testleri, yayın saati ve format deneyleri tasarlar."},
      {name:"Monetization Agent",job:"Sponsor, affiliate, ürün/hizmet ve gelir modelini geliştirir."}
    ]
  },
  {
    id:"execution",
    title:"Uygulama & Takip Masası",
    phase:"Çözüm uygulama",
    agents:[
      {name:"Execution Planner",job:"Önerileri görev, öncelik ve takvime çevirir."},
      {name:"Approval Router",job:"Kullanıcı onayı veya platform erişimi gereken işleri ayırır."},
      {name:"Performance Monitor",job:"Uygulama sonrası metrik değişimini takip eder."},
      {name:"Learning Loop",job:"Sonuçlardan öğrenip yeni çözüm önerileri üretir."}
    ]
  }
];

export const creatorWorkflow=[
  "Platform hesaplarını tara",
  "Sorunları tespit et ve puanla",
  "Creator görünürlük raporunu üret",
  "Rapor sonrası çözüm ajanlarını görevlendir",
  "Uygulanabilir işleri otomatik hazırla",
  "Erişim/onay gereken işleri ayrı kuyruğa gönder",
  "Sonuçları yeniden ölç ve öğren"
];
