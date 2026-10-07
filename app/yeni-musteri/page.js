import {servicePrice} from "../../lib/regional-pricing";
import Link from "next/link";
import NewCustomerLeadForm from "../../components/NewCustomerLeadForm";
export const metadata={title:"Yeni Müşteri | AI Visibility"};
const allowed=new Set(["business-diagnosis","business-solution","business-monitoring"]);
export default async function NewCustomerPage({searchParams}){
  const p=await searchParams;const service=allowed.has(String(p?.service||""))?String(p.service):"";const country=String(p?.country||"").slice(0,120);
  const en=country&&!/^(Türkiye|Turkey|TR)$/i.test(country);const language=en?"en":"tr";
  const prices=Object.fromEntries([["TRY","Türkiye"],["EUR","Germany"],["GBP","United Kingdom"],["USD","United States"]].map(([currency,country])=>[currency,[...allowed].map(service=>servicePrice({service,country,language}))]));
  return <main style={{maxWidth:760,margin:"0 auto",padding:"28px 20px 60px"}}>
    <header className="top" style={{marginBottom:24}}><Link href="/demo" className="brand"><span className="logo">A</span><div><strong>AI VISIBILITY</strong><small>{en?"NEW CUSTOMER":"YENİ MÜŞTERİ"}</small></div></Link><Link href="/musteri-giris" style={{textDecoration:"none"}}>{en?"Customer Login":"Müşteri Girişi"}</Link></header>
    <section className="page-head"><div><h1>{en?"I’m a new customer":"Yeni müşteriyim"}</h1><p>{en?"Tell us about your business. Your chosen service is included in your application; scope and total price are shown before payment.":"İşletmenizi tanıyalım. Seçtiğiniz hizmet başvurunuza otomatik eklenir; kapsam ve toplam ücret ödeme öncesinde gösterilir."}</p></div></section>
    <NewCustomerLeadForm initialService={service} initialCountry={country} initialLanguage={language} prices={prices}/>
    <section className="panel" style={{marginBottom:16}}><h2>{en?"How it works":"Nasıl çalışır?"}</h2><ol style={{lineHeight:1.8,paddingLeft:22}}>{(en?["Submit your business details and selected service.","We prepare an appropriate review and scope.","You receive a secure payment link.","Payment is verified.","A six-digit verification code is sent to your email.","Verify the code, set your password and sign in to your customer portal."]:["İşletme bilgilerinizi ve hizmet seçiminizi gönderirsiniz.","AI görünürlük ön değerlendirmesi ve uygun kapsam hazırlanır.","Size özel güvenli ödeme bağlantısı oluşturulur.","Ödeme doğrulanır.","E-posta adresinize 6 haneli doğrulama kodu gönderilir.","Kodu doğrulayıp şifrenizi oluşturur ve müşteri paneline girersiniz."]).map(step=><li key={step}>{step}</li>)}</ol></section>
    <section className="panel"><h2>{en?"Already a customer?":"Zaten müşteriyim"}</h2><p>{en?"If your payment is verified and your account is created, sign in with your email and password.":"Ödemeniz onaylandı ve hesabınızı oluşturduysanız e-posta ve şifrenizle giriş yapabilirsiniz."}</p><Link href="/musteri-giris">{en?"Customer login":"Müşteri girişine git"}</Link></section>
  </main>;
}