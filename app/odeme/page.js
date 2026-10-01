import {Shell} from "../../components/ui";
import PaymentManager from "../../components/PaymentManager";
export default async function Page({searchParams}){
  const p=await searchParams;
  const token=p?.token||"";
  return <Shell title="Ödeme" subtitle="Paketinizi seçin ve ödeme adımını tamamlayın.">{token?<PaymentManager token={token}/>:<section className="panel"><div className="empty">Ödeme bağlantısı geçersiz veya eksik.</div></section>}</Shell>;
}
