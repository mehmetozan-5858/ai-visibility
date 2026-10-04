import Link from "next/link";
import PublicPage from "../components/PublicPage";

export default function Home(){
  return <PublicPage title="AI Visibility" subtitle="İşletmenizin yapay zekâ arama ve öneri sistemlerindeki görünürlüğünü ölçün, sorunları tespit edin ve çözüm planına dönüştürün.">
    <p>AI Visibility; işletmeler için görünürlük skoru, detaylı analiz, raporlama, çözüm uygulama ve sürekli izleme hizmetleri sunar.</p>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12,margin:"22px 0"}}>
      <article className="panel" style={{padding:18}}><h3>Ücretsiz İlk Skor</h3><p>İlk aşamada yalnızca genel AI görünürlük skorunuzu görün.</p></article>
      <article className="panel" style={{padding:18}}><h3>Detaylı Analiz</h3><p>Ödeme sonrası eksikler, bulgular, öncelikler ve detaylı rapor açılır.</p></article>
      <article className="panel" style={{padding:18}}><h3>Çözüm ve Uygulama</h3><p>Onaylanan sorunlar için çözüm ve uygulama adımları hazırlanır ve takip edilir.</p></article>
    </div>
    <div style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:18}}>
      <Link href="/hizmetler" style={{padding:"12px 16px",borderRadius:12,background:"#2f6df6",color:"white",textDecoration:"none",fontWeight:700}}>Hizmetleri İncele</Link>
      <Link href="/musteri-giris" style={{padding:"12px 16px",borderRadius:12,border:"1px solid #31536a",textDecoration:"none",fontWeight:700}}>Müşteri Girişi</Link>
      <Link href="/yeni-musteri" style={{padding:"12px 16px",borderRadius:12,border:"1px solid #31536a",textDecoration:"none",fontWeight:700}}>Yeni Müşteri / Ön Değerlendirme</Link>
    </div>
  </PublicPage>;
}
