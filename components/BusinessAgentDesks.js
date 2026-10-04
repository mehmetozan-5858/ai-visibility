"use client";

const diagnosis=[
  ["Visibility Scanner","İşletmenin AI görünürlüğü, arama görünürlüğü ve temel dijital sinyallerini tarar."],
  ["Competitor Radar","Rakiplerin görünürlük, içerik ve konumlanma farklarını bulur."],
  ["Content Auditor","İçerik, sayfa yapısı, mesaj ve eksik konu alanlarını inceler."],
  ["Commerce Readiness Analyst","Katalog, fiyat, stok ve AI okunabilirliği eksiklerini tespit eder."],
  ["Business Impact Analyst","Bulunan sorunları ticari etki ve önceliğe göre sıralar."]
];

const solutions=[
  ["SEO & AI Visibility Agent","Görünürlük sorunları için uygulanabilir düzeltme paketi üretir."],
  ["Content Solution Agent","Eksik içerikleri, başlıkları, açıklamaları ve konu kümelerini hazırlar."],
  ["Commerce Fix Agent","Ürün/katalog verilerini AI ve satış kanalları için iyileştirme görevlerine dönüştürür."],
  ["Implementation Agent","Hazır çözümleri iş paketine çevirir ve uygulanabilir olanları yürütür."],
  ["Approval Router","Müşteri onayı veya erişim gereken işleri ayrı kuyruğa yollar."],
  ["Performance Monitor","Uygulama sonrası görünürlük ve iş etkisini yeniden ölçer."]
];

function Desk({title,subtitle,agents}){
  return <section className="panel">
    <div style={{fontSize:12,fontWeight:800,opacity:.6,textTransform:"uppercase",letterSpacing:.5}}>{subtitle}</div>
    <h2 style={{margin:"5px 0 12px"}}>{title}</h2>
    <div style={{display:"grid",gap:9}}>{agents.map(([name,job])=><div key={name} style={{padding:12,border:"1px solid rgba(148,163,184,.22)",borderRadius:12}}><strong style={{display:"block",marginBottom:3}}>{name}</strong><span style={{fontSize:13,opacity:.76}}>{job}</span></div>)}</div>
  </section>;
}

export default function BusinessAgentDesks({mode="diagnosis"}){
  return <div style={{display:"grid",gap:16}}>
    <section className="panel">
      <h2 style={{margin:"0 0 6px"}}>İşletme AI Visibility Ajan Masaları</h2>
      <p style={{margin:0,opacity:.75}}>İşletme tarafı sosyal medyadan bağımsız çalışır. Sorun bulan ajanlar ve sorun çözen ajanlar ayrı masalardadır.</p>
    </section>
    {mode==="solution"
      ? <Desk title="İşletme Çözüm Masası" subtitle="Sorun sonrası" agents={solutions}/>
      : <Desk title="İşletme Sorun Tespit Masası" subtitle="Analiz / rapor öncesi" agents={diagnosis}/>
    }
  </div>;
}
