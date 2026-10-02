import PaymentManager from "../../components/PaymentManager";
import Link from "next/link";
export default async function Page({searchParams}){
  const p=await searchParams;
  const token=p?.token||"";
  return <main style={{maxWidth:980,margin:"0 auto",padding:"28px 20px 60px"}}>
    <header style={{marginBottom:24}}>
      <Link href="/hizmetler" style={{textDecoration:"none"}}><strong>AI VISIBILITY</strong></Link>
      <p style={{marginTop:6}}>Güvenli ödeme ve müşteri hesabı aktivasyonu</p>
    </header>
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
  </main>;
}
