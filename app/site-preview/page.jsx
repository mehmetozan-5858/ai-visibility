"use client";
import {useState} from "react";
import "./preview.css";
import "./premium-visual.css";

const copy={
 tr:{
  nav:["Platform","Çözümler","Örnek rapor","Güven"],login:"Müşteri girişi",eyebrow:"DIGITAL VISIBILITY INTELLIGENCE",
  headline:"Yapay zekâda görünür olmak yetmez. Neden görünür olduğunuzu da bilin.",
  subtitle:"AI Visibility; markanızın yapay zekâ aramalarındaki görünürlüğünü ölçer, bulguları kaynaklarıyla açıklar, sorunları önceliklendirir ve iyileştirme sürecini tek yerde takip etmenizi sağlar.",
  cta:"Platformu keşfet",secondary:"Örnek raporu incele",proof:"Kanıta dayalı analiz · Şeffaf metodoloji · TR / EN deneyim",
  platformTitle:"Görünürlükten aksiyona tek platform",platformLead:"Sadece bir skor vermek yerine neyin çalıştığını, neyin eksik olduğunu ve sıradaki en değerli adımı gösteren çalışma akışı.",
  pillars:["Keşfet","Kanıtla","Önceliklendir","İyileştir"],pillarText:["AI aramalarında marka, konu ve kaynak sinyallerini tarayın.","Her önemli bulguyu kaynak ve ölçüm bağlamıyla ilişkilendirin.","Sorunları iş etkisi ve güven düzeyine göre sıralayın.","Onaylanan geliştirmeleri uygulayın, yeniden ölçün ve değişimi takip edin."],
  architectureTitle:"Bir skor ekranından fazlası: görünürlük işletim sistemi",architectureLead:"Keşiften kanıta, öncelikten uygulamaya kadar bütün karar zincirini aynı çalışma alanında birleştirin.",
  architectureNodes:["AI Search Signals","Evidence Graph","Priority Engine","Action Workspace","Executive View"],
  productTitle:"Ürünü anlatmak yerine, çalışma şeklini gösteriyoruz",productLead:"Yönetici özeti, kanıt ekranı ve aksiyon merkezi aynı veri zincirinden beslenir. Aşağıdaki ekranlar temsili ürün görünümüdür; gerçek müşteri verisi değildir.",
  productCards:[
   ["Executive Overview","Yönetici özeti","Skor, değişim, kritik bulgular ve sıradaki aksiyon tek bakışta."],
   ["Evidence Explorer","Kanıt görünümü","Bulguyu kaynak, tarih, bağlam ve güven düzeyiyle birlikte inceleyin."],
   ["Action Workspace","Aksiyon merkezi","Önceliklendirilmiş geliştirmeleri durum ve sahiplik bilgisiyle takip edin."]
  ],
  outcomesTitle:"Yönetici için netlik. Ekip için yapılacak iş.",outcomes:["Görünürlük durumunu tek ekranda anlayın","Hangi kaynakların markanızı desteklediğini görün","Eksikleri önem sırasına göre yönetin","Tekrarlanan ölçümlerle gelişimi izleyin"],
  solutions:"İşletmenize göre kullanım alanları",sectors:["Üretim ve ihracat","Uzman B2B hizmetler","E-ticaret ve ürün markaları","Dijital ajanslar"],
  sectorText:["Ürün ve uzmanlık alanlarınızın AI cevaplarında nasıl temsil edildiğini görün.","Uzmanlığınızı destekleyen kaynakları ve içerik boşluklarını belirleyin.","Ürün verisi, kategori bağlamı ve AI okunabilirliği sinyallerini takip edin.","Müşteri görünürlüğünü kanıt, öncelik ve raporlama disipliniyle yönetin."],
  report:"Karar vermeyi kolaylaştıran rapor",demo:"Temsili örnek — gerçek müşteri verisi değildir",metric:"AI görünürlük değerlendirmesi",note:"Puanlar yalnızca doğrulanmış ölçüm yapıldığında hesaplanır. Belirli sıralama, satış veya gelir sonucu garanti edilmez.",
  trustBand:["Kaynak bağlantılı bulgular","Şeffaf demo etiketi","TR / EN deneyim","Müşteri ve yönetici alanları ayrılmış"],
  contact:"AI görünürlüğünüzü daha sistemli yönetin",contactText:"Hizmet kapsamını, ülkeye göre fiyatlandırmayı ve çalışma yöntemimizi inceleyin. Doğrulanmış iletişim bilgileri iletişim sayfamızda yayımlanır.",
  footer:"Şeffaf ölçüm. Kanıta dayalı öneriler. Uygulanabilir aksiyon.",trust:"Kurumsal güveni tasarımın parçası değil, ürünün temeli yapıyoruz",
  trustItems:["Bulgular kaynak bağlantıları ve ölçüm bağlamıyla sunulur","Temsili raporlar ve demo veriler açıkça etiketlenir","Sonuç, sıralama veya gelir garantisi verilmez","Müşteri ve yönetici alanları birbirinden ayrılır","Gizlilik, KVKK, sözleşme ve iade koşulları erişilebilirdir","Yalnızca doğrulanmış özellikler müşteri karşısında aktif gösterilir"],
  legal:"Yasal bilgiler",privacy:"Gizlilik",kvkk:"KVKK",terms:"Hizmet sözleşmesi",refund:"İptal ve iade",contactLink:"İletişim",contactCta:"İletişim bilgileri",pricing:"Hizmetler ve fiyatlar"
 },
 en:{
  nav:["Platform","Solutions","Sample report","Trust"],login:"Client sign in",eyebrow:"DIGITAL VISIBILITY INTELLIGENCE",
  headline:"Visibility in AI is not enough. Know why you are visible.",
  subtitle:"AI Visibility measures how your brand appears in AI search, explains findings with evidence, prioritizes gaps, and helps you track improvement in one place.",
  cta:"Explore the platform",secondary:"View sample report",proof:"Evidence-led analysis · Transparent methodology · TR / EN experience",
  platformTitle:"From visibility to action in one platform",platformLead:"Instead of giving you only a score, the workflow shows what works, what is missing, and the next most valuable action.",
  pillars:["Discover","Evidence","Prioritize","Improve"],pillarText:["Review brand, topic, and source signals across AI search experiences.","Connect important findings to sources and measurement context.","Rank issues by business relevance and confidence.","Apply approved improvements, remeasure, and track change."],
  architectureTitle:"More than a scorecard: a visibility operating system",architectureLead:"Bring discovery, evidence, prioritization, action and executive review into one connected workspace.",
  architectureNodes:["AI Search Signals","Evidence Graph","Priority Engine","Action Workspace","Executive View"],
  productTitle:"Do not just describe the product. Show how the work flows.",productLead:"Executive summary, evidence review and action management are designed around the same evidence chain. The screens below are illustrative product views, not real customer data.",
  productCards:[
   ["Executive Overview","Executive summary","See score, change, critical findings and the next action at a glance."],
   ["Evidence Explorer","Evidence view","Review each finding with source, date, context and confidence."],
   ["Action Workspace","Action center","Track prioritized improvements with status and ownership context."]
  ],
  outcomesTitle:"Clarity for leaders. Action for teams.",outcomes:["Understand visibility status at a glance","See which sources support your brand presence","Manage gaps by priority","Track progress through repeat measurements"],
  solutions:"Use cases built around your business",sectors:["Manufacturing & export","Specialist B2B services","E-commerce & product brands","Digital agencies"],
  sectorText:["See how products and specialist expertise are represented in AI answers.","Identify supporting sources and content gaps around your expertise.","Track product data, category context and AI readability signals.","Manage client visibility with evidence, prioritization and disciplined reporting."],
  report:"A report designed for decisions",demo:"Illustrative demo — not real customer data",metric:"AI visibility assessment",note:"Scores require verified measurements. No ranking, sales, or revenue outcome is guaranteed.",
  trustBand:["Source-linked findings","Clearly labeled demos","TR / EN experience","Separated customer and admin areas"],
  contact:"Manage AI visibility with more discipline",contactText:"Explore service scope, regional pricing, and our working method. Verified contact details are published on our contact page.",
  footer:"Transparent measurement. Evidence-based recommendations. Actionable next steps.",trust:"Trust is not a visual layer. It is part of the product.",
  trustItems:["Findings include source links and measurement context","Illustrative reports and demo data are clearly labeled","No ranking, revenue, or outcome guarantees","Customer and administrator areas remain separated","Privacy, legal terms, and cancellation policies remain accessible","Only verified capabilities are presented as active"],
  legal:"Legal information",privacy:"Privacy",kvkk:"Data protection",terms:"Service agreement",refund:"Cancellation and refunds",contactLink:"Contact",contactCta:"Contact details",pricing:"Services and pricing"
 }
};
const reportBars=[72,58,84];
export default function Home(){
 const [lang,setLang]=useState("tr");const t=copy[lang];
 return <div className="site-preview"><main>
  <header className="nav wrap"><a href="#top" className="brand"><span className="mark">◈</span><span>AI Visibility</span></a><nav aria-label="Main navigation"><a href="#platform">{t.nav[0]}</a><a href="#solutions">{t.nav[1]}</a><a href="#report">{t.nav[2]}</a><a href="#trust">{t.nav[3]}</a></nav><div className="nav-actions"><button className="language" onClick={()=>setLang(lang==="tr"?"en":"tr")} aria-label="Change language">{lang==="tr"?"EN":"TR"}</button><a className="login" href="/musteri-giris">{t.login}</a></div></header>

  <section id="top" className="hero wrap"><div className="hero-content"><p className="eyebrow"><span className="dot"/> {t.eyebrow}</p><h1>{t.headline}</h1><p className="lead">{t.subtitle}</p><div className="actions"><a className="btn primary" href="#platform">{t.cta} <span aria-hidden>↗</span></a><a className="btn ghost" href="#report">{t.secondary}</a></div><p className="proof-line">{t.proof}</p><p className="disclaimer">{t.note}</p></div>
   <div className="visual enterprise-visual" aria-label={t.demo}><div className="visual-top"><span>AI Visibility / Executive View</span><span className="demo-tag">DEMO</span></div><div className="visual-body"><div className="hero-score"><div className="score-orb"><strong>72</strong><span>/100</span></div><div><span className="micro">{t.metric}</span><strong className="hero-status">Evidence-backed</strong><small>Source-linked findings</small></div></div><div className="mini-grid"><div><span>Discovery</span><b>12</b><small>signals reviewed</small></div><div><span>Evidence</span><b>8</b><small>linked findings</small></div><div><span>Priority</span><b>3</b><small>next actions</small></div></div><div className="bars">{[68,81,54,76].map((w,i)=><div key={i} className="bar-track"><div style={{width:w+"%"}}/></div>)}</div><p className="sample-label">{t.demo}</p></div></div>
  </section>

  <section className="trust-band wrap" aria-label="Trust principles">{t.trustBand.map((x,i)=><div key={x}><span>{["↗","◎","TR","⌁"][i]}</span><b>{x}</b></div>)}</section>

  <section id="platform" className="section wrap platform-section"><div className="section-heading"><p className="eyebrow">01 / PLATFORM</p><h2>{t.platformTitle}</h2><p>{t.platformLead}</p></div><div className="platform-grid">{t.pillars.map((s,i)=><article className="platform-card" key={s}><span className="number">0{i+1}</span><div className="platform-icon" aria-hidden>{["⌕","◎","↟","↻"][i]}</div><h3>{s}</h3><p>{t.pillarText[i]}</p></article>)}</div></section>

  <section className="section wrap architecture-section"><div className="architecture-copy"><p className="eyebrow">02 / SYSTEM MAP</p><h2>{t.architectureTitle}</h2><p>{t.architectureLead}</p><div className="architecture-legend"><span><i/> Evidence</span><span><i/> Priority</span><span><i/> Action</span></div></div><div className="architecture-visual" aria-label={t.demo}><div className="arch-grid"/><div className="arch-core"><span>◈</span><b>AI Visibility</b><small>Intelligence Core</small></div>{t.architectureNodes.map((n,i)=><div key={n} className={`arch-node n${i+1}`}><span>{["⌕","◎","↟","⚙","▤"][i]}</span><div><b>{n}</b><small>{["Collect","Verify","Rank","Execute","Review"][i]}</small></div></div>)}<div className="arch-line l1"/><div className="arch-line l2"/><div className="arch-line l3"/><div className="arch-line l4"/><div className="arch-line l5"/><span className="arch-demo">DEMO SYSTEM MAP</span></div></section>

  <section className="section wrap product-showcase"><div className="product-showcase-head"><p className="eyebrow">03 / PRODUCT EXPERIENCE</p><h2>{t.productTitle}</h2><p>{t.productLead}</p></div><div className="product-stage" aria-label={t.demo}>{t.productCards.map((card,i)=><article className={`product-screen ps${i+1}`} key={card[0]}><div className="screen-chrome"><span/><span/><span/><b>AI Visibility / {card[0]}</b><em>DEMO</em></div><div className="screen-body"><div className="screen-side"><span className="screen-logo">◈</span>{[1,2,3,4].map(v=><i key={v}/>)}</div><div className="screen-main"><div className="screen-title"><div><small>{card[0]}</small><strong>{card[1]}</strong></div><span>{i===0?"72/100":i===1?"8 sources":"3 priority"}</span></div>{i===0&&<><div className="mock-kpis"><div><small>Visibility</small><b>72</b></div><div><small>Evidence</small><b>8</b></div><div><small>Priority</small><b>3</b></div></div><div className="mock-chart">{[34,52,46,68,61,76,72].map((v,k)=><i key={k} style={{height:v+"%"}}/>)}</div></>}{i===1&&<div className="mock-evidence">{["Official source","Category context","Knowledge signal"].map((v,k)=><div key={v}><span>{k+1}</span><div><b>{v}</b><small>Source · date · confidence</small></div><em>{["High","High","Review"][k]}</em></div>)}</div>}{i===2&&<div className="mock-actions">{["Structured data review","Priority content gap","Re-measure visibility"].map((v,k)=><div key={v}><span>{["P1","P2","P3"][k]}</span><div><b>{v}</b><small>{["Ready","In review","Queued"][k]}</small></div><i/></div>)}</div>}<p className="screen-caption">{card[2]}</p></div></div></article>)}<span className="product-demo-label">ILLUSTRATIVE PRODUCT VIEWS · NOT CUSTOMER DATA</span></div></section>

  <section className="section wrap outcome-section"><div className="outcome-copy"><p className="eyebrow">04 / OUTCOMES</p><h2>{t.outcomesTitle}</h2></div><div className="outcome-list">{t.outcomes.map((item,i)=><div key={item}><span>0{i+1}</span><p>{item}</p></div>)}</div></section>

  <section id="solutions" className="section wrap solutions-rich"><p className="eyebrow">05 / SOLUTIONS</p><h2>{t.solutions}</h2><div className="sector-showcase">{t.sectors.map((s,i)=><a href="/hizmetler" className={`sector-rich sr${i+1}`} key={s}><div className="sector-art"><span>{["⌁","◎","▦","↗"][i]}</span><div className="sector-orbit"/><i/><i/><i/></div><div className="sector-copy"><small>0{i+1}</small><strong>{s}</strong><p>{t.sectorText[i]}</p><b>{t.pricing} ↗</b></div></a>)}</div></section>

  <section id="report" className="section wrap report-section"><div className="report-copy"><p className="eyebrow">06 / INSIGHTS</p><h2>{t.report}</h2><p>{t.platformLead}</p><a className="text-cta" href="/hizmetler">{t.pricing} ↗</a></div><div className="report"><div className="report-head"><span className="demo-tag">DEMO</span><span className="report-date">AI Visibility / Report</span></div><h3>{t.metric}</h3><p>{t.demo}</p><div className="report-grid">{["Discovery","Evidence","Readiness"].map((label,i)=><div key={label}><span>{label}</span><strong>{reportBars[i]}%</strong><div className="meter"><i style={{width:reportBars[i]+"%"}}/></div></div>)}</div><div className="finding"><span>01</span><div><b>Priority finding</b><p>Evidence, context and next action are grouped together.</p></div></div><small>{t.note}</small></div></section>

  <section id="trust" className="section wrap trust-section" aria-labelledby="trust-heading"><p className="eyebrow">07 / TRUST</p><h2 id="trust-heading">{t.trust}</h2><div className="trust-list">{t.trustItems.map(item=><div className="trust-item" key={item}><span aria-hidden="true">✓</span><p>{item}</p></div>)}</div></section>

  <section id="contact" className="section wrap contact premium-contact"><div><p className="eyebrow">08 / NEXT STEP</p><h2>{t.contact}</h2><p>{t.contactText}</p></div><div className="contact-actions"><a className="btn primary" href="/hizmetler">{t.pricing} ↗</a><a className="btn ghost" href="/iletisim">{t.contactCta} ↗</a></div></section>

  <footer className="wrap footer"><div className="footer-top"><strong>◈ AI Visibility</strong><span>{t.footer}</span></div><nav className="footer-links" aria-label={t.legal}><a href="/hizmetler">{t.pricing}</a><a href="/iletisim">{t.contactLink}</a><a href="/gizlilik">{t.privacy}</a><a href="/kvkk">{t.kvkk}</a><a href="/mesafeli-hizmet-sozlesmesi">{t.terms}</a><a href="/iptal-iade">{t.refund}</a></nav><small>© 2026 AI Visibility</small></footer>
 </main></div>
}
