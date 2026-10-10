import PaymentManager from "../../components/PaymentManager";
import Link from "next/link";

export const metadata={
  title:"Güvenli Ödeme | AI Visibility",
  description:"AI Visibility güvenli ödeme ve müşteri hesabı aktivasyon alanı.",
  robots:{index:false,follow:false,noarchive:true,nosnippet:true}
};

export default async function Page({searchParams}){
  const p=await searchParams;
  const token=p?.token||"";
  return <main className="checkout-shell">
    <header className="checkout-header">
      <Link href="/" className="checkout-brand"><span>◈</span><div><strong>AI VISIBILITY</strong><small>SECURE CHECKOUT</small></div></Link>
      <Link href="/iletisim" className="checkout-support">Destek / Support</Link>
    </header>

    <section className="checkout-intro">
      <div><span className="public-kicker">SECURE SERVICE ACTIVATION</span><h1>Güvenli ödeme ve müşteri hesabı aktivasyonu</h1><p>Hizmet kapsamı, ücret, ödeme yöntemi ve yasal koşullar ödeme öncesinde gösterilir. Paket erişimi yalnızca doğrulanmış ödeme veya açıkça tanımlanmış ücretsiz pilot üzerinden açılır.</p></div>
      <div className="checkout-trust"><span>✓ Güvenli bağlantı</span><span>✓ Ödeme doğrulaması</span><span>✓ Sözleşme onayı</span><span>✓ Müşteri erişimi ayrı</span></div>
    </section>

    <section className="checkout-workspace">
      {token?<PaymentManager token={token}/>:<section className="panel checkout-invalid"><b>Ödeme bağlantısı geçersiz veya eksik.</b><p>Güvenli ödeme bağlantınızı tekrar kontrol edin veya destek ile iletişime geçin.</p><Link href="/iletisim">İletişim →</Link></section>}
    </section>

    <section className="checkout-legal panel">
      <div><small>Ödeme öncesi bilgilendirme</small><strong>Koşulları inceleyin</strong></div>
      <nav aria-label="Ödeme ve yasal bilgiler">
        <Link href="/mesafeli-hizmet-sozlesmesi">Mesafeli Hizmet Sözleşmesi</Link>
        <Link href="/iptal-iade">İptal / İade</Link>
        <Link href="/gizlilik">Gizlilik</Link>
        <Link href="/kvkk">KVKK</Link>
        <Link href="/iletisim">İletişim</Link>
        <Link href="/musteri-giris">Müşteri Girişi</Link>
      </nav>
    </section>
  </main>;
}
