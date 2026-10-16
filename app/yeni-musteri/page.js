import {servicePrice,PADDLE_SERVICE_CODES} from "../../lib/regional-pricing";
import Link from "next/link";
import NewCustomerLeadForm from "../../components/NewCustomerLeadForm";

export const metadata={
  title:"Ücretsiz Ön Değerlendirme",
  description:"AI Visibility ücretsiz ön değerlendirmesini başlatın; işletmenizin yapay zekâ görünürlüğünü ölçen yazılım planı için başvurunuzu oluşturun.",
  alternates:{canonical:"/yeni-musteri"}
};

const allowed=new Set(PADDLE_SERVICE_CODES);
export default async function NewCustomerPage({searchParams}){
  const p=await searchParams;const service=allowed.has(String(p?.service||""))?String(p.service):"";const country=String(p?.country||"").slice(0,120);
  const en=country&&!/^(Türkiye|Turkey|TR)$/i.test(country);const language=en?"en":"tr";
  const prices=Object.fromEntries([["TRY","Türkiye"],["EUR","Germany"],["GBP","United Kingdom"],["USD","United States"]].map(([currency,country])=>[currency,[...allowed].map(service=>servicePrice({service,country,language}))]));
  const steps=en?["Submit your business details and selected software plan.","We prepare the appropriate platform access flow.","If applicable, you receive an approved free-pilot invitation or a secure payment link.","The applicable pilot or payment status is verified.","A six-digit verification code is sent to your email.","Verify the code, set your password and sign in to your customer portal."]:["İşletme bilgilerinizi ve yazılım planı seçiminizi gönderirsiniz.","Uygun platform erişim akışı hazırlanır.","Uygun durumda onaylı ücretsiz pilot daveti veya size özel güvenli ödeme bağlantısı oluşturulur.","İlgili pilot veya ödeme durumu doğrulanır.","E-posta adresinize 6 haneli doğrulama kodu gönderilir.","Kodu doğrulayıp şifrenizi oluşturur ve müşteri paneline girersiniz."];
  const schema={"@context":"https://schema.org","@type":"WebPage",name:en?"Free AI Visibility Assessment":"Ücretsiz AI Visibility Ön Değerlendirmesi",url:"https://www.aivisibilityworks.com/yeni-musteri",inLanguage:en?"en":"tr-TR",isPartOf:{"@type":"WebSite",name:"AI Visibility Works",url:"https://www.aivisibilityworks.com/"}};
  const schemaJson=JSON.stringify(schema).replace(/</g,"\\u003c");
  return <main lang={language} data-localized style={{minHeight:"100vh",background:"radial-gradient(circle at 80% 4%,rgba(70,234,215,.08),transparent 24%),linear-gradient(180deg,#03121c,#061722)",padding:"24px 20px 60px"}}>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:schemaJson}} />
    <div style={{maxWidth:1080,margin:"0 auto"}}>
      <header style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,padding:"8px 0 30px",flexWrap:"wrap"}}>
        <Link href="/" style={{display:"flex",alignItems:"center",gap:12,textDecoration:"none",color:"#eff8f8",fontWeight:800,fontSize:19}}><span style={{width:22,height:22,border:"2px solid #4be5d6",transform:"rotate(45deg)",display:"inline-block"}}/>AI Visibility</Link>
        <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}><Link href="/hizmetler" style={{textDecoration:"none"}}>{en?"Pricing":"Fiyatlandırma"}</Link><Link href="/musteri-giris" style={{padding:"10px 14px",border:"1px solid rgba(81,218,208,.28)",borderRadius:10,textDecoration:"none"}}>{en?"Customer Login":"Müşteri Girişi"}</Link></div>
      </header>
      <section style={{textAlign:"center",maxWidth:760,margin:"12px auto 28px"}}><div style={{fontSize:11,letterSpacing:".2em",fontWeight:900,color:"#54dfd0",textTransform:"uppercase"}}>{en?"Free assessment":"Ücretsiz ön değerlendirme"}</div><h1 style={{fontSize:"clamp(38px,5vw,58px)",lineHeight:1.05,letterSpacing:"-.04em",margin:"12px 0 14px"}}>{en?"See where your brand stands in AI search.":"Markanızın AI dünyasındaki yerini görün."}</h1><p style={{color:"#9fb2b8",fontSize:16,lineHeight:1.7}}>{en?"Tell us about your business. Your selected software plan is included in your application; the total price is shown before payment.":"İşletmenizi tanıyalım. Seçtiğiniz yazılım planı başvurunuza otomatik eklenir; toplam ücret ödeme öncesinde gösterilir."}</p></section>
      <div style={{maxWidth:780,margin:"0 auto"}}><NewCustomerLeadForm initialService={service} initialCountry={country} initialLanguage={language} prices={prices}/></div>
      <div className="new-customer-followup-grid" style={{display:"grid",gridTemplateColumns:"1.4fr .6fr",gap:16,maxWidth:980,margin:"18px auto 0"}}>
        <section className="panel" style={{padding:22}}><div style={{fontSize:11,color:"#54dfd0",fontWeight:800,letterSpacing:".16em",textTransform:"uppercase"}}>{en?"Next steps":"Sonraki adımlar"}</div><h2>{en?"How it works":"Nasıl çalışır?"}</h2><ol style={{lineHeight:1.8,paddingLeft:22,marginBottom:0}}>{steps.map(step=><li key={step}>{step}</li>)}</ol></section>
        <section className="panel" style={{padding:22}}><div style={{fontSize:11,color:"#54dfd0",fontWeight:800,letterSpacing:".16em",textTransform:"uppercase"}}>{en?"Already registered?":"Zaten kayıtlı mısınız?"}</div><h2>{en?"Welcome back":"Tekrar hoş geldiniz"}</h2><p>{en?"If your payment is verified and your account is created, sign in with your email and password.":"Ödemeniz onaylandı ve hesabınızı oluşturduysanız e-posta ve şifrenizle giriş yapabilirsiniz."}</p><Link href="/musteri-giris" style={{display:"inline-block",marginTop:8,fontWeight:800}}>{en?"Customer login →":"Müşteri girişine git →"}</Link></section>
      </div>
      <section className="panel" style={{padding:22,maxWidth:980,margin:"16px auto 0",lineHeight:1.75,color:"#a9bcc2"}}>
        <h2 style={{color:"#eff8f8",marginTop:0}}>{en?"What the free assessment covers":"Ücretsiz ön değerlendirme neyi kapsar?"}</h2>
        <p>{en?"The application helps configure your organization and selected software plan before paid platform access begins. AI Visibility is a cloud-based software product for measuring and monitoring AI visibility; it is not a promise of ranking, sales or permanent recommendation by an AI system.":"Başvuru; ücretli platform erişimi başlamadan önce işletmenizi ve seçtiğiniz yazılım planını yapılandırmamıza yardımcı olur. AI Visibility, AI görünürlüğünü ölçmek ve izlemek için kullanılan bulut tabanlı bir yazılım ürünüdür; herhangi bir yapay zekâ sisteminde sıralama, satış artışı veya kalıcı önerilme garantisi vermez."}</p>
        <p>{en?"Before payment, the software plan and total price are shown clearly. Customer access is created only after the applicable payment or approved pilot status is verified and the email address is confirmed.":"Ödeme öncesinde yazılım planı ve toplam ücret açıkça gösterilir. Müşteri erişimi yalnızca ilgili ödeme veya onaylı pilot durumu doğrulandıktan ve e-posta adresi onaylandıktan sonra oluşturulur."}</p>
        <p>{en?"The platform may measure how clearly your business and official sources appear in supported AI and search environments, preserve evidence, compare measurements and generate automated findings. Advertising campaign management, consulting, coaching and done-for-you implementation are not sold through this checkout.":"Platform; işletmenizin ve resmî kaynaklarınızın desteklenen AI ve arama ortamlarında ne kadar açık göründüğünü ölçebilir, kanıtları saklayabilir, ölçümleri karşılaştırabilir ve otomatik bulgular oluşturabilir. Bu ödeme akışında reklam kampanyası yönetimi, danışmanlık, koçluk veya müşteri adına yapılan manuel uygulama hizmetleri satılmaz."}</p>
      </section>
      <style>{`@media(max-width:720px){.new-customer-followup-grid{grid-template-columns:1fr!important}}`}</style>
    </div>
  </main>;
}
