import Link from "next/link";
import NewCustomerLeadForm from "../../components/NewCustomerLeadForm";
export const metadata={title:"Yeni Müşteri | AI Visibility"};
const allowed=new Set(["business-diagnosis","business-solution","business-monitoring"]);
export default async function NewCustomerPage({searchParams}){
  const p=await searchParams;const service=allowed.has(String(p?.service||""))?String(p.service):"";
  return <main style={{maxWidth:760,margin:"0 auto",padding:"28px 20px 60px"}}>
    <header className="top" style={{marginBottom:24}}><Link href="/demo" className="brand"><span className="logo">A</span><div><strong>AI VISIBILITY</strong><small>YENİ MÜŞTERİ</small></div></Link><Link href="/musteri-giris" style={{textDecoration:"none"}}>Müşteri Girişi</Link></header>
    <section className="page-head"><div><h1>Yeni müşteriyim</h1><p>İşletmenizi tanıyalım. Seçtiğiniz hizmet başvurunuza otomatik eklenir; kapsam ve toplam ücret ödeme öncesinde gösterilir.</p></div></section>
    <NewCustomerLeadForm initialService={service}/>
    <section className="panel" style={{marginBottom:16}}><h2>Nasıl çalışır?</h2><ol style={{lineHeight:1.8,paddingLeft:22}}><li>İşletme bilgilerinizi ve hizmet seçiminizi gönderirsiniz.</li><li>AI görünürlük ön değerlendirmesi ve uygun kapsam hazırlanır.</li><li>Size özel güvenli ödeme bağlantısı oluşturulur.</li><li>Ödeme doğrulanır.</li><li>E-posta adresinize 6 haneli doğrulama kodu gönderilir.</li><li>Kodu doğrulayıp şifrenizi oluşturur ve müşteri paneline girersiniz.</li></ol></section>
    <section className="panel"><h2>Zaten müşteriyim</h2><p>Ödemeniz onaylandı ve hesabınızı oluşturduysanız e-posta ve şifrenizle giriş yapabilirsiniz.</p><Link href="/musteri-giris">Müşteri girişine git</Link></section>
  </main>;
}