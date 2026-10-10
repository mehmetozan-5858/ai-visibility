"use client";
import {useState} from "react";
import "./final-preview.css";

const copy={
 tr:{
  login:"Müşteri girişi",lang:"EN",eyebrow:"DIGITAL VISIBILITY INTELLIGENCE",
  headline:"Yapay zekâda görünür olmak yetmez. Neden görünür olduğunuzu da bilin.",
  lead:"AI Visibility; markanızın yapay zekâ aramalarındaki görünürlüğünü ölçer, kanıtları kaynaklarıyla gösterir, öncelikleri belirler ve uygulanabilir aksiyonlara dönüştürür.",
  cta:"Platformu keşfet",sample:"Örnek görünümü incele",
  sec1:"Onayladığımız tasarım dili",sec1lead:"Bu önizlemede artık CSS ile taklit edilen paneller değil, doğrudan onayladığımız gerçek görsel varlıklar kullanılıyor.",
  sec2:"Görünürlük işletim sistemi",sec2lead:"Keşif, kanıt, öncelik, aksiyon ve yönetici görünümünü tek karar zincirinde birleştiren görsel yapı.",
  sec3:"Ürün deneyimi",sec3lead:"Yönetici özeti ve ürün ekranlarının gerçek tasarım referansına dayalı görünümü.",
  trust:"Kanıta dayalı · Şeffaf demo · TR / EN · Müşteri ve yönetici alanları ayrılmış",
  final:"Önizleme onaylandıktan sonra aynı görsel dil müşteri ve yönetici panellerine uygulanacak.",
  button:"Ön değerlendirme başlat"
 },
 en:{
  login:"Client sign in",lang:"TR",eyebrow:"DIGITAL VISIBILITY INTELLIGENCE",
  headline:"Visibility in AI is not enough. Know why you are visible.",
  lead:"AI Visibility measures your brand presence in AI search, shows evidence with sources, prioritizes gaps and turns findings into actionable next steps.",
  cta:"Explore platform",sample:"View sample visual",
  sec1:"Approved visual language",sec1lead:"This preview now uses the approved visual assets directly instead of recreating them with CSS mockups.",
  sec2:"Visibility operating system",sec2lead:"A connected visual system for discovery, evidence, priority, action and executive review.",
  sec3:"Product experience",sec3lead:"Executive and product views based on the approved design reference.",
  trust:"Evidence-led · Clearly labeled demo · TR / EN · Separate customer and admin areas",
  final:"After preview approval, the same visual language will be applied to customer and admin workspaces.",
  button:"Request assessment"
 }
};

export default function SitePreview(){
 const [lang,setLang]=useState("tr");
 const t=copy[lang];
 return <main className="final-preview">
  <header className="topbar shell">
   <a className="brand" href="#top"><span>◈</span>AI Visibility</a>
   <div className="top-actions"><button onClick={()=>setLang(lang==="tr"?"en":"tr")}>{t.lang}</button><a href="/musteri-giris">{t.login}</a></div>
  </header>

  <section id="top" className="hero shell">
   <div className="hero-copy">
    <p className="eyebrow">{t.eyebrow}</p>
    <h1>{t.headline}</h1>
    <p className="lead">{t.lead}</p>
    <div className="actions"><a className="primary" href="#approved">{t.cta} ↗</a><a className="secondary" href="#system">{t.sample}</a></div>
    <p className="trustline">{t.trust}</p>
   </div>
   <figure className="visual-card hero-visual"><img src="/approved-visuals/homepage-concept.webp" alt="AI Visibility approved homepage concept"/><figcaption>APPROVED VISUAL · DEMO</figcaption></figure>
  </section>

  <section id="approved" className="section shell two-col">
   <div className="copy-block"><p className="section-no">01 / APPROVED VISUAL</p><h2>{t.sec1}</h2><p>{t.sec1lead}</p></div>
   <figure className="visual-card"><img src="/approved-visuals/dashboard-concept.webp" alt="Approved AI Visibility dashboard concept"/><figcaption>REAL APPROVED ASSET · NOT CSS RECREATION</figcaption></figure>
  </section>

  <section id="system" className="section shell two-col reverse-mobile">
   <figure className="visual-card"><img src="/approved-visuals/platform-map.webp" alt="Approved AI Visibility platform map"/><figcaption>APPROVED SYSTEM MAP</figcaption></figure>
   <div className="copy-block"><p className="section-no">02 / SYSTEM MAP</p><h2>{t.sec2}</h2><p>{t.sec2lead}</p></div>
  </section>

  <section className="section shell">
   <div className="copy-block wide"><p className="section-no">03 / PRODUCT EXPERIENCE</p><h2>{t.sec3}</h2><p>{t.sec3lead}</p></div>
   <div className="gallery">
    <figure className="visual-card"><img src="/approved-visuals/homepage-concept.webp" alt="Approved AI Visibility interface"/></figure>
    <figure className="visual-card"><img src="/approved-visuals/dashboard-concept.webp" alt="Approved AI Visibility dashboard"/></figure>
    <figure className="visual-card"><img src="/approved-visuals/platform-map.webp" alt="Approved AI Visibility architecture visual"/></figure>
   </div>
  </section>

  <section className="cta shell"><div><h2>{t.final}</h2><p>Preview only · canlı site ve müşteri verileri değiştirilmedi.</p></div><a className="primary" href="/on-degerlendirme">{t.button} ↗</a></section>

  <footer className="footer shell"><strong>◈ AI Visibility</strong><span>© 2026 AI Visibility</span></footer>
 </main>
}
