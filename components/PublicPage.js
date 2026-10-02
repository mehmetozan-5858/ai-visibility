import Link from "next/link";

export default function PublicPage({title,subtitle,children}){
  const links=[
    ["/hizmetler","Hizmetler"],
    ["/hakkimizda","Hakkımızda"],
    ["/iletisim","İletişim"],
    ["/gizlilik","Gizlilik"],
    ["/kvkk","KVKK / Aydınlatma"],
    ["/iptal-iade","İptal / İade"],
    ["/mesafeli-hizmet-sozlesmesi","Hizmet Sözleşmesi"]
  ];
  return <main style={{maxWidth:980,margin:"0 auto",padding:"28px 20px 60px"}}>
    <header style={{display:"flex",justifyContent:"space-between",gap:16,alignItems:"center",flexWrap:"wrap",marginBottom:28}}>
      <Link href="/hizmetler" style={{textDecoration:"none"}}><strong>AI VISIBILITY</strong></Link>
      <nav style={{display:"flex",gap:12,flexWrap:"wrap"}}>{links.slice(0,3).map(([h,l])=><Link key={h} href={h}>{l}</Link>)}</nav>
    </header>
    <section className="panel" style={{padding:28}}>
      <h1>{title}</h1>{subtitle&&<p>{subtitle}</p>}
      <div style={{lineHeight:1.7}}>{children}</div>
    </section>
    <footer style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:24,fontSize:13}}>
      {links.map(([h,l])=><Link key={h} href={h}>{l}</Link>)}
      <Link href="/login">Yönetici Girişi</Link>
    </footer>
  </main>;
}
