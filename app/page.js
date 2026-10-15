import Link from "next/link";
import styles from "./home.module.css";

export const metadata={
 title:{absolute:"AI Visibility Works | Yapay Zekâ Görünürlük Platformu"},
 alternates:{canonical:"/"},
 openGraph:{url:"https://www.aivisibilityworks.com"}
};

const Bar=({label,value,width})=><div className={styles.barRow}><div className={styles.barMeta}><span>{label}</span><b>{value}</b></div><div className={styles.track}><i style={{width}}/></div></div>;

const faq=[
 ["AI görünürlüğü nedir?","AI görünürlüğü, markanızın yapay zekâ yanıtlarında anılması, önerilmesi veya kaynak olarak gösterilmesidir. GEO ve AEO çalışmaları bu görünürlüğü iyileştirmeyi hedefler."],
 ["İlk analizde ne alırım?","Tamamlanan taramaların skorunu, sağlayıcı sonuçlarını, bulguları ve önerileri görürsünüz. Veri henüz yoksa panel bunu açıkça belirtir; örnek ekranlar gerçek müşteri sonucu değildir."],
 ["Google sıralaması ile AI görünürlüğü aynı mı?","Hayır. Google arama sonuçlarındaki sıralama ile AI yanıtlarındaki görünürlük farklı ölçümlerdir. Teknik SEO, erişilebilir sayfalar ve açık marka bilgileri her iki çalışma için de temel oluşturur."],
 ["Hangi yapay zekâ motorları ölçülür?","Kapsamı analizdeki sağlayıcı sonuçları belirler. Her sağlayıcının durumu ayrı değerlendirilir; kullanılamayan veya ölçülmeyen bir motor başarılı ölçüm gibi gösterilmez."],
 ["Ücretsiz başvuru panel hesabı açar mı?","Başvuru ücretsizdir. Panel erişimi, onaylı pilot daveti veya ödeme doğrulaması ve e-posta onayı sonrasında oluşturulur."],
 ["Ücret ve hizmet kapsamını nerede görürüm?","Hizmetler sayfasında kapsamı ve ülkenize göre fiyatları inceleyebilirsiniz. Başvuruda seçtiğiniz hizmet kaydedilir; ödeme öncesinde toplam ücret gösterilir."],
 ["Görünürlük veya satış artışı garanti mi?","Hayır. AI yanıtları ve arama sonuçları değişebilir. Ölçüm, kanıt ve öncelikli öneriler sunarız; belirli bir sıralama veya satış sonucu garanti etmeyiz."]
];
const structuredData={"@context":"https://schema.org","@graph":[
 {"@type":"Organization","@id":"https://www.aivisibilityworks.com/#organization",name:"AI Visibility",url:"https://www.aivisibilityworks.com",logo:"https://www.aivisibilityworks.com/icon.png",description:"İşletmeler için yapay zekâ görünürlük analizi, kanıt incelemesi ve iyileştirme hizmetleri."},
 {"@type":"WebSite","@id":"https://www.aivisibilityworks.com/#website",url:"https://www.aivisibilityworks.com",name:"AI Visibility Works",inLanguage:"tr",publisher:{"@id":"https://www.aivisibilityworks.com/#organization"}}
]};
export default function Home(){
 const steps=[
  ["1","⌕","Keşfet","Bağlı sağlayıcılardaki değerlendirmeleri ve kaydedilen yanıt örneklerini inceleyin."],
  ["2","▤","Doğrula","Gerçek veriler ve kanıtlarla içgörüleri derinleştirin. Nedenleri ve fırsatları anlayın."],
  ["3","ϟ","Harekete Geç","Özel öneriler ve yol haritasıyla somut adımlar atın. Değişikliklerden sonra sonuçları yeniden değerlendirin."]
 ];
 const solutions=[
  ["▥","Üretim ve ihracat","Ürün ve uzmanlık alanınızın AI cevaplarında nasıl temsil edildiğini görün."],
  ["◎","Uzman B2B hizmetler","Uzmanlığınızı destekleyen kaynakları ve içerik boşluklarını belirleyin."],
  ["▣","E-ticaret ve ürün markaları","Ürün verisi, kategori bağlamı ve AI okunabilirliği sinyallerini takip edin."],
  ["▥","Dijital ajanslar","Müşterilerinizin AI görünürlüğünü ölçün, strateji geliştirin ve etkinizi raporlayın."]
 ];
 return <div className={styles.page}><div className={styles.shell}>
  <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(structuredData).replace(/</g,"\\u003c")}}/>
  <header className={styles.nav}>
   <Link href="/" className={styles.brand}><span className={styles.logo}/><span>AI Visibility</span></Link>
   <nav className={styles.navlinks}><a href="#urun">Ürün</a><a href="#cozumler">Çözümler</a><a href="#rapor">Kaynaklar</a><Link href="/hizmetler">Fiyatlandırma</Link><Link href="/hakkimizda">Hakkımızda</Link></nav>
   <div className={styles.actions}><Link className={styles.ghost} href="/musteri-giris">Giriş yap</Link><Link className={styles.cta} href="/yeni-musteri">Ücretsiz ön değerlendirme →</Link></div>
  </header>

  <section className={styles.hero}>
   <div>
    <div className={styles.eyebrow}>Yapay zekâ dünyasında markanızı görünür kılın</div>
    <h1>AI görünürlüğünüz <span>büyüme gücünüzdür.</span></h1>
    <p className={styles.lead}>Markanızın yapay zekâ platformlarında nasıl göründüğünü analiz edin, kanıtlarla güçlendirin ve etkisini artırın. Daha fazla görünürlük, daha fazla fırsat, daha güçlü büyüme.</p>
    <div className={styles.heroButtons}><Link className={styles.cta} href="/yeni-musteri">Ücretsiz ön değerlendirme →</Link><Link className={styles.outline} href="/demo">◉ Ürün demosunu incele</Link></div>
    <div className={styles.checks}><span>Hızlı kurulum</span><span>Kredi kartı gerekmez</span><span>Uzman ekibimizle tanışın</span></div>
   </div>
   <div className={styles.visual} aria-label="Örnek rapor görselleştirmesi; gerçek müşteri verisi değildir">
    <div className={styles.orbit}/>
    <div className={`${styles.floatCard} ${styles.fc1}`}><strong>⌕ AI Arama Görünürlüğü</strong><div className={styles.miniBars}>{[22,31,39,48,58,67].map((h,i)=><i key={i} style={{height:h}}/>)}</div></div>
    <div className={`${styles.floatCard} ${styles.fc2}`}><strong>💡 Stratejik Öneriler</strong><div className={styles.mockLine}/><div className={`${styles.mockLine} ${styles.short}`}/></div>
    <div className={`${styles.floatCard} ${styles.fc3}`}><strong>↗ Hareket Planı</strong><div className={styles.miniBars}>{[18,25,29,38,44,54].map((h,i)=><i key={i} style={{height:h}}/>)}</div></div>
    <div className={styles.dashboard}>
     <div className={styles.dashTop}><div className={styles.dashBrand}>◇ AI Visibility · Örnek</div><span className={styles.pill}>Son 30 gün⌄</span></div>
     <div className={styles.scoreArea}><div className={styles.ring}><div className={styles.ringText}><strong>72</strong><small>/100</small></div></div><div className={styles.bars}><Bar label="Görünürlük" value="72" width="72%"/><Bar label="Kanıt Desteği" value="58" width="58%"/><Bar label="Hazırlık Seviyesi" value="84" width="84%"/></div></div>
    </div>
   </div>
  </section>

  <div className={styles.divider}/>
  <section className={styles.how}>
   <div className={styles.sectionHead}><div><div className={styles.kicker}>Nasıl çalışır?</div><h2>Üç adımda somut sonuçlar.</h2></div><p>Karmaşık verileri anlaşılır içgörülere dönüştürüyor, net aksiyonlarla markanızın AI görünürlüğünü artırıyoruz.</p></div>
   <div className={styles.steps}>{steps.map(([n,ic,t,p])=><article className={styles.step} key={t}><span className={styles.stepNum}>{n}</span><span className={styles.iconBox}>{ic}</span><div><h3>{t}</h3><p>{p}</p></div></article>)}</div>
  </section>

  <section id="cozumler" className={styles.solutions}>
   <div className={styles.solutionIntro}><div className={styles.kicker}>Çözümler</div><h2>Sektörünüze özel AI görünürlük çözümleri.</h2><p>Her sektörün ihtiyaçlarına uygun, kanıta dayalı içgörüler ve aksiyon odaklı çözümler.</p><Link className={styles.outline} href="/hizmetler">Tüm çözümleri keşfedin →</Link></div>
   <div className={styles.solutionGrid}>{solutions.map(([ic,t,p])=><article className={styles.solution} key={t}><div className={styles.solutionIcon}>{ic}</div><h3>{t}</h3><p>{p}</p><Link className={styles.more} href="/hizmetler">Detayları incele →</Link></article>)}</div>
  </section>

  <section id="urun" className={styles.product}>
   <div className={styles.productIntro}><div className={styles.kicker}>Ürün deneyimi · Örnek ekranlar</div><h2>Tüm ihtiyaçlarınız için entegre bir platform.</h2><p>Analiz, kanıt, strateji ve aksiyon. AI Visibility ile tüm süreci tek bir platformda yönetin.</p><Link className={styles.outline} href="/demo">Ürünü yakından inceleyin →</Link></div>
   <div className={styles.productGrid}>
    {[['Executive Overview','Markanızın AI görünürlüğüne dair yönetici özeti, skorlar ve eğilimler.'],['Evidence Explorer','Görünürlük kaynaklarını, alıntıları ve kanıtları detaylı olarak inceleyin.'],['Action Workspace','Kişiselleştirilmiş önerileri, öncelikleri ve uygulama yol haritasını yönetin.']].map(([t,p],idx)=><article className={styles.productCard} key={t}><div className={styles.mock}><strong>{idx===0?'72 / 100':idx===1?'ChatGPT · Google AI':'✓ Öncelikli aksiyonlar'}</strong><div className={styles.mockLine}/><div className={`${styles.mockLine} ${styles.short}`}/><div className={styles.mockLine}/></div><h3>{t}</h3><p>{p}</p></article>)}
   </div>
  </section>

  <section id="rapor" className={styles.reports}>
   <div className={styles.reportIntro}><div className={styles.kicker}>İçgörüler ve raporlama · Örnek ekran</div><h2>Karar vermeyi kolaylaştıran raporlar.</h2><p>Sadece bir skor değil, neyin neden olduğunu ve sonraki adımda ne yapmanız gerektiğini gösteren net içgörüler.</p><Link className={styles.outline} href="/demo">Örnek raporu görüntüle →</Link></div>
   <div className={styles.reportCard}><div className={styles.reportRing}><span>72</span></div><div className={styles.findings}><strong>Öne çıkan bulgular</strong><div className={styles.finding}>↗ Sektör karşılaştırmasında güçlü görünürlük</div><div className={styles.finding}>! Kaynak alıntılarında gelişim fırsatı</div><div className={styles.finding}>◆ Teknik içeriklerde iyileştirme alanı</div></div></div>
   <aside className={styles.trust}><div className={styles.kicker}>Güven ve standartlar</div><h3>Daha şeffaf, daha güvenilir bir AI ekosistemi.</h3><p>Veriye dayalı, kanıtlanabilir ve sorumlu bir yapay zekâ görünürlük yönetimi için tasarlandı.</p><div className={styles.trustGrid}><span>◈ Şeffaf analiz</span><span>▤ Kanıta dayalı</span><span>▣ Veri gizliliği</span><span>✓ Açık ölçüm yöntemi</span></div></aside>
  </section>

  <section className={styles.how} aria-labelledby="first-analysis">
   <div className={styles.sectionHead}><div><div className={styles.kicker}>İlk analizde ne görürsünüz?</div><h2 id="first-analysis">Skordan sonraki adımınıza kadar.</h2></div><p>Marka ve web sitenizle başlayın. Ülkenizi ve sektörünüzü belirtin; sonuçları müşteri panelinde inceleyin. İlk ölçüm tamamlanana kadar panel veri beklediğini gösterir.</p></div>
   <div className={styles.steps}>{[["Ölçüm ve geçmiş","Tamamlanan taramalar, son skor ve önceki ölçümle değişim."],["Bulgu ve kanıt","Sağlayıcı sonuçları, bulguların önem seviyesi ve örnek rapor."],["Çözüm ve takip","Hizmet kapsamına göre öneriler, çözüm talepleri ve çalışma durumu."]].map(([t,p])=><article className={styles.solution} key={t}><h3>{t}</h3><p>{p}</p></article>)}</div>
   <div className={styles.heroButtons}><Link className={styles.cta} href="/yeni-musteri">Markam için ön değerlendirme iste →</Link><Link className={styles.outline} href="/demo">Örnek raporu incele</Link></div>
  </section>
  <section className={styles.how} aria-labelledby="faq-heading"><div className={styles.kicker}>Karar vermeden önce</div><h2 id="faq-heading">Sık sorulan sorular</h2><div className={styles.faq}>{faq.map(([q,a])=><details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div><p><Link className={styles.more} href="/metodoloji">Skorlar ve kanıtlar nasıl yorumlanır? →</Link></p><Link className={styles.more} href="/iletisim">Sorunuz mu var? Bize ulaşın →</Link></section>
  <div className={styles.logos}><span>ChatGPT</span><span>Gemini</span><span>Perplexity</span><span>AI Search</span><span>GEO</span><span>AEO</span><span>Evidence Intelligence</span></div>
  <footer className={styles.footer}><div><div className={styles.brand}><span className={styles.logo}/><span>AI Visibility</span></div><p>Markanızı yapay zekâ dünyasında daha görünür, daha güvenilir ve daha güçlü kılar.</p><div className={styles.legal}>© 2026 AI Visibility · Tüm hakları saklıdır.</div></div><div className={styles.footerLinks}><div><strong>Ürün</strong><a href="#urun">Genel Bakış</a><Link href="/hizmetler">Fiyatlandırma</Link></div><div><strong>Çözümler</strong><a href="#cozumler">Üretim & İhracat</a><a href="#cozumler">B2B Hizmetler</a></div><div><strong>Kaynaklar</strong><a href="#rapor">Raporlar</a><Link href="/demo">Demo</Link><Link href="/metodoloji">Ölçüm yöntemi</Link><Link href="/yapay-zeka-gorunurlugu">GEO / AEO rehberi</Link></div><div><strong>Hakkımızda</strong><Link href="/hakkimizda">Hakkımızda</Link><Link href="/iletisim">İletişim</Link><Link href="/gizlilik">Gizlilik</Link><Link href="/mesafeli-hizmet-sozlesmesi">Hizmet Koşulları</Link><Link href="/iptal-iade">İptal ve İade</Link><Link href="/kvkk">KVKK</Link></div></div></footer>
 </div></div>;
}