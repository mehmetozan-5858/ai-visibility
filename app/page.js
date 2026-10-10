import Link from "next/link";
import styles from "./home.module.css";

const Bar=({label,value,width})=><div className={styles.barRow}><div className={styles.barMeta}><span>{label}</span><b>{value}</b></div><div className={styles.track}><i style={{width}}/></div></div>;

export default function Home(){
 const steps=[
  ["1","⌕","Keşfet","Görünürlüğünüzü analiz edin. Tüm yapay zekâ platformlarında markanızın mevcut durumunu görün."],
  ["2","▤","Doğrula","Gerçek veriler ve kanıtlarla içgörüleri derinleştirin. Nedenleri ve fırsatları anlayın."],
  ["3","ϟ","Harekete Geç","Özel öneriler ve yol haritasıyla somut adımlar atın. Görünürlüğünüzü kalıcı şekilde artırın."]
 ];
 const solutions=[
  ["▥","Üretim ve ihracat","Ürün ve uzmanlık alanınızın AI cevaplarında nasıl temsil edildiğini görün."],
  ["◎","Uzman B2B hizmetler","Uzmanlığınızı destekleyen kaynakları ve içerik boşluklarını belirleyin."],
  ["▣","E-ticaret ve ürün markaları","Ürün verisi, kategori bağlamı ve AI okunabilirliği sinyallerini takip edin."],
  ["▥","Dijital ajanslar","Müşterilerinizin AI görünürlüğünü ölçün, strateji geliştirin ve etkinizi raporlayın."]
 ];
 return <div className={styles.page}><div className={styles.shell}>
  <header className={styles.nav}>
   <Link href="/" className={styles.brand}><span className={styles.logo}/><span>AI Visibility</span></Link>
   <nav className={styles.navlinks}><a href="#urun">Ürün</a><a href="#cozumler">Çözümler</a><a href="#rapor">Kaynaklar</a><Link href="/hizmetler">Fiyatlandırma</Link><Link href="/hakkimizda">Şirket</Link></nav>
   <div className={styles.actions}><Link className={styles.ghost} href="/musteri-giris">Giriş yap</Link><Link className={styles.cta} href="/yeni-musteri">Ücretsiz demo al →</Link></div>
  </header>

  <section className={styles.hero}>
   <div>
    <div className={styles.eyebrow}>Yapay zekâ dünyasında markanızı görünür kılın</div>
    <h1>AI görünürlüğünüz <span>büyüme gücünüzdür.</span></h1>
    <p className={styles.lead}>Markanızın yapay zekâ platformlarında nasıl göründüğünü analiz edin, kanıtlarla güçlendirin ve etkisini artırın. Daha fazla görünürlük, daha fazla fırsat, daha güçlü büyüme.</p>
    <div className={styles.heroButtons}><Link className={styles.cta} href="/yeni-musteri">Ücretsiz demo al →</Link><Link className={styles.outline} href="/demo">◉ Ürün demosunu incele</Link></div>
    <div className={styles.checks}><span>Hızlı kurulum</span><span>Kredi kartı gerekmez</span><span>Uzman ekibimizle tanışın</span></div>
   </div>
   <div className={styles.visual}>
    <div className={styles.orbit}/>
    <div className={`${styles.floatCard} ${styles.fc1}`}><strong>⌕ AI Arama Görünürlüğü</strong><div className={styles.miniBars}>{[22,31,39,48,58,67].map((h,i)=><i key={i} style={{height:h}}/>)}</div></div>
    <div className={`${styles.floatCard} ${styles.fc2}`}><strong>💡 Stratejik Öneriler</strong><div className={styles.mockLine}/><div className={`${styles.mockLine} ${styles.short}`}/></div>
    <div className={`${styles.floatCard} ${styles.fc3}`}><strong>↗ Hareket Planı</strong><div className={styles.miniBars}>{[18,25,29,38,44,54].map((h,i)=><i key={i} style={{height:h}}/>)}</div></div>
    <div className={styles.dashboard}>
     <div className={styles.dashTop}><div className={styles.dashBrand}>◇ AI Visibility</div><span className={styles.pill}>Son 30 gün⌄</span></div>
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
   <div className={styles.productIntro}><div className={styles.kicker}>Ürün deneyimi</div><h2>Tüm ihtiyaçlarınız için entegre bir platform.</h2><p>Analiz, kanıt, strateji ve aksiyon. AI Visibility ile tüm süreci tek bir platformda yönetin.</p><Link className={styles.outline} href="/demo">Ürünü yakından inceleyin →</Link></div>
   <div className={styles.productGrid}>
    {[['Executive Overview','Markanızın AI görünürlüğüne dair yönetici özeti, skorlar ve eğilimler.'],['Evidence Explorer','Görünürlük kaynaklarını, alıntıları ve kanıtları detaylı olarak inceleyin.'],['Action Workspace','Kişiselleştirilmiş önerileri, öncelikleri ve uygulama yol haritasını yönetin.']].map(([t,p],idx)=><article className={styles.productCard} key={t}><div className={styles.mock}><strong>{idx===0?'72 / 100':idx===1?'ChatGPT · Google AI':'✓ Öncelikli aksiyonlar'}</strong><div className={styles.mockLine}/><div className={`${styles.mockLine} ${styles.short}`}/><div className={styles.mockLine}/></div><h3>{t}</h3><p>{p}</p></article>)}
   </div>
  </section>

  <section id="rapor" className={styles.reports}>
   <div className={styles.reportIntro}><div className={styles.kicker}>İçgörüler ve raporlama</div><h2>Karar vermeyi kolaylaştıran raporlar.</h2><p>Sadece bir skor değil, neyin neden olduğunu ve sonraki adımda ne yapmanız gerektiğini gösteren net içgörüler.</p><Link className={styles.outline} href="/demo">Örnek raporu görüntüle →</Link></div>
   <div className={styles.reportCard}><div className={styles.reportRing}><span>72</span></div><div className={styles.findings}><strong>Öne çıkan bulgular</strong><div className={styles.finding}>↗ Sektör karşılaştırmasında güçlü görünürlük</div><div className={styles.finding}>! Kaynak alıntılarında gelişim fırsatı</div><div className={styles.finding}>◆ Teknik içeriklerde iyileştirme alanı</div></div></div>
   <aside className={styles.trust}><div className={styles.kicker}>Güven ve standartlar</div><h3>Daha şeffaf, daha güvenilir bir AI ekosistemi.</h3><p>Veriye dayalı, kanıtlanabilir ve sorumlu bir yapay zekâ görünürlük yönetimi için tasarlandı.</p><div className={styles.trustGrid}><span>◈ Şeffaf analiz</span><span>▤ Kanıta dayalı</span><span>▣ Veri gizliliği</span><span>✓ Doğrulanmış sistem</span></div></aside>
  </section>

  <div className={styles.logos}><span>Arçelik</span><span>LC WAIKIKI</span><span>FORD OTOSAN</span><span>trendyol</span><span>TÜRK HAVA YOLLARI</span><span>Vodafone</span><span>Hepsiburada</span></div>
  <footer className={styles.footer}><div><div className={styles.brand}><span className={styles.logo}/><span>AI Visibility</span></div><p>Markanızı yapay zekâ dünyasında daha görünür, daha güvenilir ve daha güçlü kılar.</p><div className={styles.legal}>© 2026 AI Visibility · Tüm hakları saklıdır.</div></div><div className={styles.footerLinks}><div><strong>Ürün</strong><a href="#urun">Genel Bakış</a><Link href="/hizmetler">Fiyatlandırma</Link></div><div><strong>Çözümler</strong><a href="#cozumler">Üretim & İhracat</a><a href="#cozumler">B2B Hizmetler</a></div><div><strong>Kaynaklar</strong><a href="#rapor">Raporlar</a><Link href="/demo">Demo</Link></div><div><strong>Şirket</strong><Link href="/hakkimizda">Hakkımızda</Link><Link href="/iletisim">İletişim</Link><Link href="/gizlilik">Gizlilik</Link></div></div></footer>
 </div></div>;
}
