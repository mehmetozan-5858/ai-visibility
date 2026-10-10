import Link from "next/link";
import PublicPage from "../../components/PublicPage";
import {servicePrice,formatMoney} from "../../lib/regional-pricing";

export const metadata={title:"AI Visibility | Hizmetler ve Fiyatlar",description:"AI görünürlük analizi, GEO/AEO çözüm uygulama ve sürekli takip hizmetleri; ülkeye göre fiyatlandırma."};

const packages=[
 {code:"business-diagnosis",badge:"Başlangıç için ideal",title:"AI Visibility Analizi + Rapor",type:"Tek seferlik",audience:"AI görünürlüğünü ilk kez ölçmek isteyen işletmeler",desc:"Markanızın AI aramalarındaki mevcut görünürlüğünü, kaynak sinyallerini ve geliştirme alanlarını netleştiren başlangıç paketi.",items:["AI görünürlük değerlendirmesi","Kaynak ve sinyal incelemesi","Sorun ve fırsat tespiti","Önceliklendirilmiş detaylı rapor","Geliştirme yol haritası"],deliverable:"Kanıta dayalı analiz raporu + öncelikli aksiyon listesi",featured:false},
 {code:"business-solution",badge:"Uygulama",title:"Çözüm / Uygulama Paketi",type:"Kapsam bazlı",audience:"Sorunları belirlenmiş ve uygulama desteği isteyen işletmeler",desc:"Analizde doğrulanan ve sizin tarafınızdan onaylanan sorunlar için teknik, içerik ve yapılandırma geliştirmeleri uygulanır.",items:["Onaylanan sorunların çözümü","GEO / AEO iyileştirmeleri","İçerik ve yapılandırılmış veri çalışmaları","Teknik görünürlük geliştirmeleri","Uygulama sonrası yeniden ölçüm"],deliverable:"Onaylı geliştirmeler + uygulama sonrası karşılaştırmalı kontrol",featured:true},
 {code:"business-monitoring",badge:"Süreklilik",title:"Sürekli Takip + Optimizasyon",type:"Aylık hizmet",audience:"AI görünürlüğünü düzenli izlemek ve korumak isteyen ekipler",desc:"Görünürlük sinyalleri periyodik olarak izlenir; değişimler, yeni sorunlar ve fırsatlar düzenli şekilde raporlanır.",items:["Periyodik görünürlük takibi","Karşılaştırmalı raporlama","Yeni sorun ve fırsat tespiti","Öncelik güncellemeleri","Sürekli optimizasyon planı"],deliverable:"Periyodik rapor + değişim takibi + yeni aksiyon planı",featured:false}
];
const countries=["Türkiye","United Kingdom","United States","Germany","France","Italy","Spain","Netherlands","Belgium","Austria","Ireland","Portugal","Poland","Romania","Bulgaria","Greece","Sweden","Norway","Denmark","Finland","Switzerland","Canada","Australia","United Arab Emirates","Saudi Arabia","Qatar","Japan","South Korea","India","China","Brazil","Mexico","South Africa"];
const rows=[
 ["İlk görünürlük değerlendirmesi",true,false,true],
 ["Detaylı bulgu ve öncelik raporu",true,true,true],
 ["Teknik / içerik uygulaması",false,true,false],
 ["Uygulama sonrası yeniden ölçüm",false,true,true],
 ["Periyodik takip",false,false,true],
 ["Yeni sorun / fırsat tespiti",true,true,true]
];
function display(service,country){const p=servicePrice({service,country,language:"tr"});const locale=p.currency==="TRY"?"tr-TR":p.currency==="GBP"?"en-GB":p.currency==="EUR"?"de-DE":"en-US";return formatMoney(p.amount,p.currency,locale)+(p.kind==="from"?"'dan başlayan":p.kind==="monthly"?" / ay":"")}
function Mark({yes}){return <span className={yes?"pricing-yes":"pricing-no"} aria-label={yes?"Dahil":"Dahil değil"}>{yes?"✓":"—"}</span>}
export default async function Page({searchParams}){
 const sp=await searchParams;const requested=String(sp?.country||"Türkiye");const country=countries.includes(requested)?requested:"Türkiye";
 return <PublicPage title="Hizmetler ve Fiyatlar" subtitle="İhtiyacınıza göre başlayın, kapsamı ödeme öncesinde netleştirin. Fiyatlar seçtiğiniz ülkenin para birimiyle gösterilir.">
  <section className="pricing-intro"><div><p className="public-kicker">ŞEFFAF FİYATLANDIRMA</p><h2>Tek skor değil, ihtiyaca göre doğru hizmet</h2><p>İlk ölçüm, çözüm uygulaması ve sürekli takip birbirinden ayrıdır. Böylece yalnızca gerçekten ihtiyacınız olan hizmet için ilerlersiniz.</p></div><form method="get" className="pricing-country"><label>Fiyatlandırma ülkesi<select name="country" defaultValue={country}>{countries.map(x=><option key={x}>{x}</option>)}</select></label><button type="submit">Fiyatları göster</button></form></section>

  <div className="pricing-grid">
   {packages.map(p=><article className={`pricing-card${p.featured?" pricing-featured":""}`} key={p.code}><div className="pricing-card-top"><span className="pricing-badge">{p.badge}</span><span className="pricing-type">{p.type}</span></div><h2>{p.title}</h2><p className="pricing-audience">{p.audience}</p><div className="pricing-price">{display(p.code,country)}</div><small className="pricing-country-label">{country}</small><p>{p.desc}</p><div className="pricing-deliverable"><b>Teslim edilen çıktı</b><span>{p.deliverable}</span></div><ul>{p.items.map(x=><li key={x}><span>✓</span>{x}</li>)}</ul><Link className="pricing-cta" href={`/yeni-musteri?service=${encodeURIComponent(p.code)}&country=${encodeURIComponent(country)}`}>Başvuru sürecini başlat <span aria-hidden>↗</span></Link></article>)}
  </div>

  <section className="pricing-compare" aria-labelledby="compare-heading"><div className="pricing-section-head"><p className="public-kicker">PAKET KARŞILAŞTIRMA</p><h2 id="compare-heading">Hangisi size uygun?</h2><p>Paketi seçmeden önce kapsam farklarını tek ekranda karşılaştırın.</p></div><div className="pricing-table-wrap"><table><thead><tr><th>Özellik</th>{packages.map(p=><th key={p.code}>{p.title}</th>)}</tr></thead><tbody>{rows.map(([label,...vals])=><tr key={label}><td>{label}</td>{vals.map((yes,i)=><td key={packages[i].code}><Mark yes={yes}/></td>)}</tr>)}</tbody></table></div></section>

  <section className="pricing-guidance"><div><p className="public-kicker">SEÇİM REHBERİ</p><h2>Nereden başlamalısınız?</h2></div><div className="pricing-guidance-grid"><article><span>01</span><h3>Henüz ölçüm yapılmadıysa</h3><p><b>Analiz + Rapor</b> ile başlayın. Önce mevcut durumu ve gerçek sorunları görün.</p></article><article><span>02</span><h3>Sorunlar belliyse</h3><p><b>Çözüm / Uygulama</b> paketine geçin. Yalnızca onaylanan geliştirmeler uygulanır.</p></article><article><span>03</span><h3>Sürekli takip istiyorsanız</h3><p><b>Takip + Optimizasyon</b> ile değişimleri düzenli izleyin ve yeni fırsatları kaçırmayın.</p></article></div></section>

  <section className="pricing-trust"><div><p className="public-kicker">ÖDEME ÖNCESİ ŞEFFAFLIK</p><h2>Sürpriz kapsam veya gizli ücret yok</h2></div><div className="pricing-trust-grid"><p><b>Kesin kapsam:</b> Çözüm paketinde uygulanacak işler ve toplam ücret ödeme öncesinde netleştirilir.</p><p><b>Ek maliyet:</b> Üçüncü taraf veya ek iş maliyeti varsa ayrıca gösterilir ve onayınız olmadan eklenmez.</p><p><b>Sonuç garantisi:</b> Belirli bir AI sıralaması, müşteri sayısı veya gelir artışı garanti edilmez.</p><p><b>Hizmet başlangıcı:</b> Yalnızca doğrulanmış ödeme ve hesap aktivasyonu tamamlandıktan sonra başlatılır.</p></div></section>

  <section className="pricing-process"><div className="pricing-section-head"><p className="public-kicker">SATIN ALMA AKIŞI</p><h2>Dört adımda başlayın</h2></div><ol><li><span>01</span><div><b>Ülkenizi ve paketinizi seçin</b><p>Fiyat ve para birimi seçiminize göre gösterilir.</p></div></li><li><span>02</span><div><b>İşletme bilgilerinizi gönderin</b><p>Seçtiğiniz hizmet ve ülke başvurunuza otomatik taşınır.</p></div></li><li><span>03</span><div><b>Kapsam ve toplam bedeli doğrulayın</b><p>Ödeme yöntemi aktifse sözleşme, toplam ücret ve hizmet başlangıç koşullarını kontrol edin.</p></div></li><li><span>04</span><div><b>Hesabınızı aktive edin</b><p>Doğrulanmış ödeme sonrasında müşteri hesabınız oluşturulur ve hizmet süreci başlar.</p></div></li></ol></section>

  <section className="pricing-legal"><h2>Ödeme öncesi yasal bilgiler</h2><div><Link href="/mesafeli-hizmet-sozlesmesi">Mesafeli Hizmet Sözleşmesi</Link><Link href="/iptal-iade">İptal / İade Politikası</Link><Link href="/gizlilik">Gizlilik</Link><Link href="/kvkk">KVKK</Link><Link href="/iletisim">İletişim</Link></div></section>
 </PublicPage>;
}