import Link from "next/link";

export const metadata={title:"AI Visibility Demo"};

export default function DemoPage(){
  return <main style={{maxWidth:980,margin:"0 auto",padding:"28px 20px 60px"}}>
    <header className="top" style={{marginBottom:24}}>
      <Link href="/demo" className="brand"><span className="logo">A</span><div><strong>AI VISIBILITY</strong><small>DEMO MÜŞTERİ GÖRÜNÜMÜ</small></div></Link>
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
        <Link href="/yeni-musteri" style={{textDecoration:"none",fontWeight:700}}>Yeni müşteriyim</Link>
        <Link href="/musteri-giris" style={{textDecoration:"none"}}>Müşteri Girişi</Link>
      </div>
    </header>

    <section className="page-head"><div><h1>Müşteri Paneli Demo</h1><p>Bu sayfa yalnızca tanıtım amaçlıdır. Aşağıdaki tüm bilgiler örnek veridir; gerçek müşteri, ödeme veya yönetici verisi içermez.</p></div></section>

    <section className="panel" style={{marginBottom:16}}>
      <h2>Örnek İşletme</h2>
      <p>demo.ai-visibility.app</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:12,marginTop:18}}>
        <div className="content-plan"><small>AI görünürlük</small><h2>68/100</h2></div>
        <div className="content-plan"><small>Paket</small><h2>Pro</h2></div>
        <div className="content-plan"><small>Tamamlanan tarama</small><h2>4</h2></div>
      </div>
    </section>

    <section className="panel" style={{marginBottom:16}}>
      <h2>Görünürlük özeti</h2>
      <p>ChatGPT, Gemini ve Perplexity üzerinde marka görünürlüğü, yerel işletme sinyalleri ve içerik yeterliliği birlikte değerlendirilir.</p>
      <div className="content-plan" style={{marginTop:14}}>
        <b>Öncelikli geliştirme alanları</b>
        <ul>
          <li>Yerel işletme bilgilerinde NAP tutarlılığı</li>
          <li>FAQ ve yapılandırılmış veri kapsamı</li>
          <li>AI asistanlarının anlayabileceği hizmet açıklamaları</li>
        </ul>
      </div>
    </section>

    <section className="panel" style={{marginBottom:16}}>
      <h2>Son taramalar</h2>
      <div className="client-list">
        <article className="client-row"><div><b>68/100</b><small>Son tarama · bugün</small></div><span>+9</span></article>
        <article className="client-row"><div><b>59/100</b><small>Önceki tarama · 30 gün önce</small></div><span>Başlangıç</span></article>
      </div>
    </section>

    <section className="panel" style={{marginBottom:16}}>
      <h2>Çalışmalar</h2>
      <div className="client-list">
        <article className="client-row"><div><b>FAQ + Schema iyileştirmesi</b><small>Tamamlandı</small></div><span>✓</span></article>
        <article className="client-row"><div><b>Yerel işletme verisi düzenleme</b><small>Uygulamada</small></div><span>Devam</span></article>
        <article className="client-row"><div><b>AI içerik önerileri</b><small>Müşteri onayı bekliyor</small></div><span>Bekliyor</span></article>
      </div>
    </section>

    <section className="panel">
      <h2>Ödeme ve hesap güvenliği</h2>
      <p>Gerçek müşteri hesabında yalnızca o işletmeye ait taramalar, çalışmalar, raporlar ve ödeme kayıtları gösterilir.</p>
      <div style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:16}}>
        <Link href="/yeni-musteri">Yeni müşteriyim / Hesabımı oluştur</Link>
        <Link href="/hizmetler">Hizmetleri incele</Link>
        <Link href="/musteri-giris">Mevcut müşteri girişi</Link>
      </div>
    </section>
  </main>;
}
