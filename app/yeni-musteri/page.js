import Link from "next/link";

export const metadata={title:"Yeni Müşteri | AI Visibility"};

export default function NewCustomerPage(){
  return <main style={{maxWidth:760,margin:"0 auto",padding:"28px 20px 60px"}}>
    <header className="top" style={{marginBottom:24}}>
      <Link href="/demo" className="brand"><span className="logo">A</span><div><strong>AI VISIBILITY</strong><small>YENİ MÜŞTERİ</small></div></Link>
      <Link href="/musteri-giris" style={{textDecoration:"none"}}>Müşteri Girişi</Link>
    </header>

    <section className="page-head"><div><h1>Yeni müşteriyim</h1><p>AI Visibility hesabı ödeme onayından sonra güvenli şekilde açılır. Böylece ödeme yapmamış kişiler gerçek müşteri paneline erişemez.</p></div></section>

    <section className="panel" style={{marginBottom:16}}>
      <h2>Nasıl çalışır?</h2>
      <ol style={{lineHeight:1.8,paddingLeft:22}}>
        <li>İşletmeniz için AI görünürlük analizi ve uygun paket hazırlanır.</li>
        <li>Size özel güvenli ödeme bağlantısı oluşturulur.</li>
        <li>Havale/EFT ödemeniz yönetici tarafından doğrulanır.</li>
        <li>E-posta adresinize 6 haneli doğrulama kodu gönderilir.</li>
        <li>Kodu doğrulayıp şifrenizi oluşturursunuz.</li>
        <li>Bundan sonra müşteri paneline e-posta ve şifrenizle giriş yaparsınız.</li>
      </ol>
    </section>

    <section className="panel" style={{marginBottom:16}}>
      <h2>Önce uygulamayı görmek ister misiniz?</h2>
      <p>Gerçek müşteri verisi içermeyen örnek müşteri panelini inceleyebilirsiniz.</p>
      <Link href="/demo" style={{display:"inline-block",padding:"11px 16px",borderRadius:10,textDecoration:"none",fontWeight:700}}>Demo müşteri panelini aç</Link>
    </section>

    <section className="panel">
      <h2>Hesap açmak için</h2>
      <p>Önce hizmet ve paket sürecini başlatın. Ödeme bağlantınız oluşturulduğunda hesap açma işlemi aynı bağlantı üzerinden tamamlanır.</p>
      <div style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:16}}>
        <Link href="/hizmetler">Hizmetleri incele</Link>
        <Link href="/iletisim">İletişime geç</Link>
        <Link href="/musteri-giris">Zaten müşteriyim</Link>
      </div>
    </section>
  </main>;
}
