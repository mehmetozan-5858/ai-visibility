import Link from "next/link";
import PublicPage from "../../components/PublicPage";

export const metadata={title:"AI Visibility | Hizmetler ve Fiyatlar",description:"AI görünürlük analizi, GEO/AEO çözüm uygulama ve sürekli takip hizmetleri; kapsam ve başlangıç fiyatları."};

const packages=[
  {title:"AI Visibility Analizi + Rapor",price:"4.990 TL",type:"Tek seferlik",desc:"İşletmenizin AI görünürlüğü ölçülür; sorunlar, öncelikler ve geliştirme alanları detaylı raporlanır.",items:["AI görünürlük skoru","Sorun ve eksiklerin tespiti","Önceliklendirilmiş detaylı rapor","Geliştirme yol haritası"]},
  {title:"Çözüm / Uygulama Paketi",price:"19.900 TL'den başlayan",type:"Tek seferlik",desc:"Analizde belirlenen ve müşteri tarafından onaylanan sorunlar için teknik ve içerik iyileştirmeleri uygulanır.",items:["Onaylanan sorunların çözümü","GEO / AEO iyileştirmeleri","İçerik ve yapılandırılmış veri çalışmaları","Uygulama sonrası yeniden ölçüm"]},
  {title:"Sürekli Takip + Optimizasyon",price:"6.990 TL / ay",type:"Aylık hizmet",desc:"Görünürlük düzenli olarak takip edilir; değişimler raporlanır ve gerekli optimizasyon görevleri planlanır.",items:["Periyodik görünürlük takibi","Karşılaştırmalı raporlama","Yeni sorun ve fırsat tespiti","Sürekli optimizasyon planı"]}
];

export default function Page(){return <PublicPage title="Hizmetler ve Fiyatlar" subtitle="Satın alabileceğiniz AI görünürlük, analiz ve iyileştirme hizmetleri. Tüm hizmetler dijital olarak sunulur.">
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:16,margin:"24px 0"}}>
    {packages.map(p=><article className="panel" style={{padding:20}} key={p.title}>
      <div style={{fontSize:13,opacity:.75}}>{p.type}</div>
      <h2 style={{fontSize:21,marginBottom:8}}>{p.title}</h2>
      <div style={{fontSize:24,fontWeight:800,margin:"10px 0"}}>{p.price}</div>
      <p>{p.desc}</p>
      <ul>{p.items.map(x=><li key={x}>{x}</li>)}</ul>
      <Link href="/yeni-musteri" style={{display:"inline-block",marginTop:10,padding:"12px 16px",borderRadius:12,background:"#2f6df6",color:"white",textDecoration:"none",fontWeight:700}}>Satın Alma Sürecini Başlat</Link>
    </article>)}
  </div>

  <section className="panel" style={{padding:20,marginTop:18}}>
    <h2>Nasıl satın alınır?</h2>
    <ol>
      <li>“Satın Alma Sürecini Başlat” ile işletme bilgilerinizi girin.</li>
      <li>İhtiyacınıza uygun hizmet ve kapsam kesinleştirilir.</li>
      <li>Güvenli ödeme ekranında toplam ücret, sözleşmeler ve hizmet başlangıç onayı gösterilir.</li>
      <li>Ödeme onayından sonra müşteri hesabınız aktive edilir ve hizmet başlatılır.</li>
    </ol>
    <p><b>Not:</b> Çözüm paketlerinde fiyat, uygulanacak işlerin kapsamına göre ödeme öncesinde kesin olarak gösterilir. Müşterinin onayı olmadan ek ücret oluşturulmaz.</p>
  </section>

  <section className="panel" style={{padding:20,marginTop:18}}>
    <h2>Ödeme öncesi yasal bilgiler</h2>
    <p>Satın almadan önce hizmet kapsamını, iptal/iade koşullarını ve sözleşmeleri inceleyebilirsiniz.</p>
    <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
      <Link href="/mesafeli-hizmet-sozlesmesi">Mesafeli Hizmet Sözleşmesi</Link>
      <Link href="/iptal-iade">İptal / İade Politikası</Link>
      <Link href="/gizlilik">Gizlilik</Link>
      <Link href="/kvkk">KVKK</Link>
      <Link href="/iletisim">İletişim</Link>
    </div>
  </section>
</PublicPage>}
