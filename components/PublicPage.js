import Link from "next/link";

const nav=[
  ["/","Ana Sayfa"],
  ["/hizmetler","Çözümler ve Fiyatlar"],
  ["/demo","Demo"],
  ["/hakkimizda","Hakkımızda"],
  ["/iletisim","İletişim"]
];
const legal=[
  ["/gizlilik","Gizlilik"],
  ["/kvkk","KVKK / Aydınlatma"],
  ["/iptal-iade","İptal / İade"],
  ["/mesafeli-hizmet-sozlesmesi","Hizmet Sözleşmesi"]
];

export default function PublicPage({title,subtitle,children}){
  return <main style={{maxWidth:1160,margin:"0 auto",padding:"0 20px 60px"}}>
    <header style={{minHeight:74,display:"flex",justifyContent:"space-between",gap:18,alignItems:"center",flexWrap:"wrap",borderBottom:"1px solid #143541",marginBottom:34}}>
      <Link href="/" style={{display:"flex",alignItems:"center",gap:11,textDecoration:"none",fontWeight:800,fontSize:18}}>
        <span style={{width:20,height:20,border:"2px solid #48eadb",transform:"rotate(45deg)",display:"inline-block",boxShadow:"0 0 16px #43e3d666"}}/>
        <span>AI Visibility</span>
      </Link>
      <nav style={{display:"flex",gap:18,flexWrap:"wrap",alignItems:"center",fontSize:14}}>{nav.slice(1).map(([h,l])=><Link key={h} href={h} style={{color:"#b5c8ce"}}>{l}</Link>)}</nav>
      <div style={{display:"flex",gap:10,alignItems:"center"}}>
        <Link href="/musteri-giris" style={{padding:"10px 14px",border:"1px solid #274755",borderRadius:10,textDecoration:"none"}}>Giriş yap</Link>
        <Link href="/yeni-musteri" style={{padding:"10px 14px",borderRadius:10,background:"linear-gradient(90deg,#4de2d5,#79f1e2)",color:"#052028",fontWeight:800,textDecoration:"none"}}>Ücretsiz demo al →</Link>
      </div>
    </header>

    <section style={{marginBottom:24}}>
      <div style={{fontSize:11,letterSpacing:".22em",textTransform:"uppercase",fontWeight:800,color:"#4edfd2",marginBottom:10}}>AI Visibility</div>
      <h1 style={{fontSize:"clamp(34px,5vw,54px)",lineHeight:1.04,letterSpacing:"-.035em",margin:"0 0 12px"}}>{title}</h1>
      {subtitle&&<p style={{maxWidth:760,color:"#9db2ba",fontSize:16,lineHeight:1.65,margin:0}}>{subtitle}</p>}
    </section>

    <section className="panel" style={{padding:"clamp(20px,4vw,34px)",borderRadius:22,background:"linear-gradient(145deg,#081d28,#071722)",border:"1px solid #173d4c",boxShadow:"0 18px 50px #0004"}}>
      <div style={{lineHeight:1.7}}>{children}</div>
    </section>

    <footer style={{marginTop:32,paddingTop:24,borderTop:"1px solid #143541",display:"grid",gridTemplateColumns:"1fr auto",gap:24,alignItems:"start"}}>
      <div><strong style={{display:"block",marginBottom:6}}>AI Visibility</strong><span style={{color:"#819ba5",fontSize:12}}>Markanızı yapay zekâ dünyasında daha görünür, daha güvenilir ve daha güçlü kılar.</span></div>
      <div style={{display:"flex",gap:14,flexWrap:"wrap",justifyContent:"flex-end",fontSize:12,color:"#93aab2"}}>
        {legal.map(([h,l])=><Link key={h} href={h}>{l}</Link>)}
        <Link href="/login">Yönetici Girişi</Link>
      </div>
    </footer>
  </main>;
}
