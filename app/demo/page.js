"use client";
import Link from "next/link";
import {useState} from "react";

const tabs=[
  ["overview","Genel Bakış"],
  ["visibility","AI Görünürlük"],
  ["actions","Öneriler"],
  ["report","★ Rapor"],
  ["plans","Paketler"]
];

export default function DemoPage(){
  const [tab,setTab]=useState("overview");
  return <main style={{maxWidth:980,margin:"0 auto",padding:"28px 20px 60px"}}>
    <header className="top" style={{marginBottom:24}}>
      <Link href="/demo" className="brand"><span className="logo">A</span><div><strong>AI VISIBILITY</strong><small>DEMO MÜŞTERİ GÖRÜNÜMÜ</small></div></Link>
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
        <Link href="/yeni-musteri" style={{textDecoration:"none",fontWeight:700}}>Yeni müşteriyim</Link>
        <Link href="/musteri-giris" style={{textDecoration:"none"}}>Müşteri Girişi</Link>
      </div>
    </header>

    <section className="page-head"><div><h1>Müşteri Paneli Demo</h1><p>Merak ettiğin bölümlere dokunarak gerçek müşteri panelinin nasıl çalıştığını örnek verilerle inceleyebilirsin. Hiçbir gerçek müşteri veya ödeme verisi gösterilmez.</p></div></section>

    <nav aria-label="Demo bölümleri" style={{display:"flex",gap:8,overflowX:"auto",padding:"4px 0 16px",WebkitOverflowScrolling:"touch"}}>
      {tabs.map(([id,label])=><button key={id} onClick={()=>setTab(id)} style={{whiteSpace:"nowrap",padding:"10px 14px",borderRadius:12,border:tab===id?"1px solid #6ed7ff":"1px solid rgba(255,255,255,.18)",background:tab===id?"rgba(69,185,255,.18)":"rgba(255,255,255,.04)",fontWeight:tab===id?700:500}}>{label}</button>)}
    </nav>

    {tab==="overview"&&<>
      <section className="panel" style={{marginBottom:16}}>
        <h2>Örnek İşletme</h2><p>demo.ai-visibility.app</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:12,marginTop:18}}>
          <div className="content-plan"><small>AI görünürlük</small><h2>68/100</h2></div>
          <div className="content-plan"><small>Paket</small><h2>Pro</h2></div>
          <div className="content-plan"><small>Tamamlanan tarama</small><h2>4</h2></div>
        </div>
      </section>
      <section className="panel"><h2>Son gelişme</h2><p>Örnek işletmenin görünürlük skoru son 30 günde 59’dan 68’e çıktı.</p><div className="client-list"><article className="client-row"><div><b>68/100</b><small>Son tarama · bugün</small></div><span>+9</span></article><article className="client-row"><div><b>59/100</b><small>Önceki tarama · 30 gün önce</small></div><span>Başlangıç</span></article></div></section>
    </>}

    {tab==="visibility"&&<section className="panel">
      <h2>AI Görünürlük Analizi</h2><p>Markanın yapay zekâ asistanlarında ne kadar anlaşılır ve önerilebilir olduğunu örnek olarak gösterir.</p>
      <div className="client-list" style={{marginTop:14}}>
        <article className="client-row"><div><b>ChatGPT</b><small>Marka ve hizmet açıklamaları güçlü</small></div><span>74/100</span></article>
        <article className="client-row"><div><b>Gemini</b><small>Yerel işletme sinyalleri geliştirilebilir</small></div><span>66/100</span></article>
        <article className="client-row"><div><b>Perplexity</b><small>Kaynak ve referans kapsamı artırılabilir</small></div><span>64/100</span></article>
      </div>
      <div className="content-plan" style={{marginTop:14}}><b>Öncelikli geliştirme alanları</b><ul><li>Yerel işletme bilgilerinde NAP tutarlılığı</li><li>FAQ ve yapılandırılmış veri kapsamı</li><li>AI asistanlarının anlayabileceği hizmet açıklamaları</li></ul></div>
    </section>}

    {tab==="actions"&&<section className="panel">
      <h2>Öneriler ve Çalışmalar</h2><p>Müşteri, hangi iyileştirmenin neden önerildiğini ve hangi aşamada olduğunu görebilir.</p>
      <div className="client-list" style={{marginTop:14}}>
        <article className="client-row"><div><b>FAQ + Schema iyileştirmesi</b><small>Etkisi: yüksek · Tamamlandı</small></div><span>✓</span></article>
        <article className="client-row"><div><b>Yerel işletme verisi düzenleme</b><small>Etkisi: yüksek · Uygulamada</small></div><span>Devam</span></article>
        <article className="client-row"><div><b>AI içerik önerileri</b><small>Etkisi: orta · Müşteri onayı bekliyor</small></div><span>Bekliyor</span></article>
      </div>
    </section>}

    {tab==="report"&&<section className="panel" style={{position:"relative",overflow:"hidden",minHeight:390}}>
      <div style={{filter:"blur(7px)",opacity:.38,pointerEvents:"none",userSelect:"none"}} aria-hidden="true">
        <h2>AI Visibility Pro Raporu</h2><p>Mevcut skor, bulunan sorunlar, öncelikler, yapılan çalışmalar ve önce/sonra değişimi.</p>
        <div className="content-plan" style={{marginTop:14}}><b>Yönetici özeti</b><p>AI görünürlüğü 30 günde +9 puan arttı. En büyük kazanım yapılandırılmış veri ve hizmet açıklamalarından geldi. Sıradaki öncelik yerel kaynakların güçlendirilmesi.</p></div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:12,marginTop:14}}><div className="content-plan"><small>Önce</small><h2>59</h2></div><div className="content-plan"><small>Şimdi</small><h2>68</h2></div><div className="content-plan"><small>Değişim</small><h2>+9</h2></div></div>
        <div className="client-list" style={{marginTop:14}}><article className="client-row"><div><b>Kritik bulgular</b><small>Detaylı sorun ve çözüm listesi</small></div><span>12</span></article><article className="client-row"><div><b>Öncelikli aksiyonlar</b><small>Etki ve uygulama sırasına göre</small></div><span>8</span></article></div>
      </div>
      <div style={{position:"absolute",inset:0,display:"grid",placeItems:"center",padding:24,background:"linear-gradient(180deg,rgba(4,14,24,.18),rgba(4,14,24,.78))"}}>
        <div className="content-plan" style={{maxWidth:520,textAlign:"center",padding:24}}>
          <div style={{fontSize:34,marginBottom:8}}>★ 🔒</div>
          <h2 style={{marginBottom:8}}>Pro Raporu</h2>
          <p>Tam rapor Pro müşterilere özeldir. Pro olduğunda tüm bulguları, öncelikleri, aksiyon planını, önce/sonra karşılaştırmasını ve tam raporu görebilirsin.</p>
          <Link href="/yeni-musteri" style={{display:"inline-block",marginTop:12,fontWeight:800}}>Pro ile tüm raporu aç →</Link>
        </div>
      </div>
    </section>}

    {tab==="plans"&&<section className="panel">
      <h2>Paketler nasıl çalışır?</h2><p>Demo fiyat göstermez; gerçek teklifte işletmenin ihtiyacına göre analiz ve uygulama kapsamı oluşturulur.</p>
      <div className="client-list" style={{marginTop:14}}><article className="client-row"><div><b>Analiz</b><small>Mevcut AI görünürlüğünü ve eksikleri bulur</small></div><span>1</span></article><article className="client-row"><div><b>Uygulama</b><small>Seçilen kritik/yüksek öncelikli iyileştirmeleri hayata geçirir</small></div><span>2</span></article><article className="client-row"><div><b>Takip</b><small>Tekrar ölçer ve değişimi raporlar</small></div><span>3</span></article></div>
      <div style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:18}}><Link href="/yeni-musteri" style={{fontWeight:700}}>Yeni müşteriyim / Başlamak istiyorum</Link><Link href="/hizmetler">Hizmetleri incele</Link></div>
    </section>}
  </main>;
}
