import {Shell} from "../../components/ui";
import PaymentManager from "../../components/PaymentManager";
export default async function Page({searchParams}){
  const p=await searchParams;
  const clientId=p?.clientId||"";
  return <Shell title="Ödeme" subtitle="Paketinizi seçin ve ödeme adımını tamamlayın.">{clientId?<PaymentManager clientId={clientId}/>:<section className="panel"><div className="empty">Ödeme için bir müşteri seçilmedi.</div></section>}</Shell>;
}
