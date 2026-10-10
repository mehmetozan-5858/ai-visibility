import Link from "next/link";
import PublicPage from "../../components/PublicPage";
import "./contact-premium.css";

export const metadata={
  title:"İletişim | AI Visibility",
  description:"AI Visibility hizmet kapsamı, teklif, ödeme ve destek konuları için doğrulanmış iletişim kanalları."
};

export default function Page(){
  const email=process.env.PUBLIC_CONTACT_EMAIL||"";
  const phone=process.env.PUBLIC_CONTACT_PHONE||"";

  return <PublicPage
    title="Doğru kanaldan, şeffaf şekilde iletişim kurun"
    subtitle="Hizmet kapsamı, teklif, ödeme ve destek konularında yalnızca doğrulanmış iletişim bilgilerini kullanıyoruz."
  >
    <div className="contact-premium-grid">
      <section className="contact-channel-card" aria-labelledby="contact-channel-title">
        <span className="contact-kicker">DOĞRULANMIŞ İLETİŞİM</span>
        <h2 id="contact-channel-title">AI Visibility</h2>
        <p className="contact-intro">Müşteri iletişim bilgileri ile yönetici hesap kurtarma bilgileri birbirinden ayrı tutulur.</p>

        <div className="contact-channels">
          <div className="contact-channel">
            <span aria-hidden="true">@</span>
            <div>
              <small>E-posta</small>
              {email?<a href={`mailto:${email}`}>{email}</a>:<strong>Henüz yayımlanmadı</strong>}
            </div>
          </div>
          <div className="contact-channel">
            <span aria-hidden="true">☎</span>
            <div>
              <small>Telefon</small>
              {phone?<strong>{phone}</strong>:<strong>Henüz yayımlanmadı</strong>}
            </div>
          </div>
        </div>

        {!email&&<p className="contact-notice">Genel iletişim e-postası henüz yayımlanmadığı için bu sayfada e-posta ile başvuru alındığı iddia edilmez.</p>}
      </section>

      <section className="contact-support-card" aria-labelledby="support-title">
        <span className="contact-kicker">DESTEK AKIŞI</span>
        <h2 id="support-title">Bize hangi konuda ulaşıyorsunuz?</h2>
        <div className="support-options">
          <div><b>01</b><span><strong>Hizmet ve fiyat</strong><small>Paket kapsamı, ülke bazlı fiyatlandırma ve satın alma öncesi sorular.</small></span></div>
          <div><b>02</b><span><strong>Mevcut müşteri desteği</strong><small>Hesap erişimi, rapor, tarama veya çözüm süreciyle ilgili destek.</small></span></div>
          <div><b>03</b><span><strong>Ödeme ve sözleşme</strong><small>Ödeme öncesi toplam bedel, sözleşme ve iade koşullarının açıklanması.</small></span></div>
        </div>
      </section>
    </div>

    <section className="contact-trust-strip" aria-label="İletişim güven ilkeleri">
      <div><span>✓</span><p><b>Şeffaf kapsam</b><small>Hizmet kapsamı ödeme öncesinde netleştirilir.</small></p></div>
      <div><span>✓</span><p><b>Doğrulanmış kanallar</b><small>Yalnızca bu sayfada yayımlanan iletişim bilgileri kullanılır.</small></p></div>
      <div><span>✓</span><p><b>Yasal erişim</b><small>Gizlilik, sözleşme ve iade koşulları erişilebilir tutulur.</small></p></div>
    </section>

    <div className="contact-next-actions">
      <Link className="public-primary-link" href="/hizmetler">Hizmetleri ve fiyatları incele →</Link>
      <Link className="public-secondary-link" href="/musteri-giris">Müşteri girişi</Link>
      <Link className="public-secondary-link" href="/gizlilik">Gizlilik</Link>
      <Link className="public-secondary-link" href="/mesafeli-hizmet-sozlesmesi">Hizmet sözleşmesi</Link>
      <Link className="public-secondary-link" href="/iptal-iade">İptal ve iade</Link>
    </div>

    <p className="contact-security-note"><small>Güvenlik amacıyla yönetici hesap kurtarma bilgileri kamuya açık iletişim bilgisi olarak kullanılmaz.</small></p>
  </PublicPage>;
}
