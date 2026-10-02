import {Shell} from "../../components/ui";
import PaymentManager from "../../components/PaymentManager";
export default async function Page({searchParams}){
  const p=await searchParams;
  const token=p?.token||"";
  return <Shell title="Ödeme" subtitle="Paketinizi seçin ve ödeme adımını tamamlayın.">
    {token?<PaymentManager token={token}/>:<section className="panel"><div className="empty">Ödeme bağlantısı geçersiz veya eksik.</div></section>}
    <section className="panel" style={{marginTop:16}}>
      <small>Ödeme öncesi bilgilendirme:</small>
      <div style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:8}}>
        <a href="/mesafeli-hizmet-sozlesmesi">Mesafeli Hizmet Sözleşmesi</a>
        <a href="/iptal-iade">İptal / İade</a>
        <a href="/gizlilik">Gizlilik</a>
        <a href="/kvkk">KVKK</a>
        <a href="/iletisim">İletişim</a>
      </div>
    </section>
  </Shell>;
}
