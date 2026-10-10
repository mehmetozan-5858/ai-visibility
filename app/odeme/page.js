import PaymentManager from "../../components/PaymentManager";
import Link from "next/link";

export const metadata={
  title:"Güvenli Ödeme",
  robots:{index:false,follow:false,nocache:true},
  referrer:"no-referrer"
};

export default async function Page({searchParams}){
  const p=await searchParams;
  const token=p?.token||"";
  return <main style={{minHeight:"100vh",background:"radial-gradient(circle at 75% 0%,rgba(70,234,215,.08),transparent 26%),linear-gradient(180deg,#03121c,#061722)",padding:"26px 20px 60px"}}>
    <div style={{maxWidth:980,margin:"0 auto"}}>
      <header style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,marginBottom:26,flexWrap:"wrap"}}>
        <Link href="/" style={{display:"flex",alignItems:"center",gap:12,textDecoration:"none",color:"#eff8f8",fontWeight:800,fontSize:19}}><span style={{width:22,height:22,border:"2px solid #4be5d6",transform:"rotate(45deg)",display:"inline-block"}}/>AI Visibility</Link>
        <Link href="/musteri-giris" style={{textDecoration:"none"}}>Müşteri Girişi</Link>
      </header>
      <section style={{marginBottom:24}}>
        <div style={{fontSize:11,letterSpacing:".18em",fontWeight:900,color:"#54dfd0",textTransform:"uppercase",marginBottom:8}}>Güvenli ödeme alanı</div>
        <h1 style={{fontSize:"clamp(32px,5vw,48px)",letterSpacing:"-.035em",margin:"0 0 8px"}}>Ödeme ve müşteri hesabı aktivasyonu</h1>
        <p style={{color:"#9fb2b8",maxWidth:720,lineHeight:1.7}}>Paketinizi, tutarı ve ödeme yöntemini kontrol edin. Ödeme onayından sonra e-posta doğrulamasıyla müşteri hesabınızı güvenli şekilde oluşturabilirsiniz.</p>
      </section>
      {token?<PaymentManager token={token}/>:<section className="panel"><div className="empty">Ödeme bağlantısı geçersiz veya eksik.</div></section>}
      <section className="panel" style={{marginTop:16}}>
        <small>Ödeme öncesi bilgilendirme:</small>
        <div style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:8}}>
          <a href="/mesafeli-hizmet-sozlesmesi">Mesafeli Hizmet Sözleşmesi</a>
          <a href="/iptal-iade">İptal / İade</a>
          <a href="/gizlilik">Gizlilik</a>
          <a href="/kvkk">KVKK</a>
          <a href="/iletisim">İletişim</a>
          <a href="/musteri-giris">Müşteri Girişi</a>
        </div>
      </section>
    </div>
  </main>;
}
