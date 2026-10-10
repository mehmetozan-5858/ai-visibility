import Link from "next/link";

export default function PublicPage({title,subtitle,children}){
  const primary=[
    ["/hizmetler","Hizmetler ve Fiyatlar"],
    ["/hakkimizda","Hakkımızda"],
    ["/iletisim","İletişim"]
  ];
  const legal=[
    ["/gizlilik","Gizlilik"],
    ["/kvkk","KVKK / Aydınlatma"],
    ["/iptal-iade","İptal / İade"],
    ["/mesafeli-hizmet-sozlesmesi","Hizmet Sözleşmesi"]
  ];
  return <main className="public-shell">
    <header className="public-header">
      <Link href="/" className="public-brand" aria-label="AI Visibility ana sayfa"><span>◈</span><div><strong>AI VISIBILITY</strong><small>GEO / AEO INTELLIGENCE</small></div></Link>
      <nav className="public-nav" aria-label="Ana navigasyon">{primary.map(([h,l])=><Link key={h} href={h}>{l}</Link>)}</nav>
      <Link href="/musteri-giris" className="public-login">Müşteri Girişi</Link>
    </header>
    <section className="public-page-head">
      <p className="public-kicker">AI VISIBILITY</p>
      <h1>{title}</h1>{subtitle&&<p>{subtitle}</p>}
    </section>
    <section className="public-content">
      <div className="public-content-inner">{children}</div>
    </section>
    <footer className="public-footer">
      <div className="public-footer-brand"><strong>◈ AI Visibility</strong><p>Şeffaf ölçüm. Kanıta dayalı öneriler. Sonuç garantisi verilmez.</p></div>
      <nav aria-label="Kurumsal bağlantılar">{primary.concat(legal).map(([h,l])=><Link key={h} href={h}>{l}</Link>)}</nav>
      <small>© 2026 AI Visibility</small>
    </footer>
  </main>;
}
