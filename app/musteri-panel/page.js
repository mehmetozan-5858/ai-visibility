import CustomerShell from "../../components/CustomerShell";
import CustomerPortalGate from "../../components/CustomerPortalGate";
export default function Page(){
  return <CustomerShell title="Müşteri Paneli" subtitle="AI görünürlüğünüz, çalışmalarınız, rapor süreciniz ve ödemeleriniz.">
    <CustomerPortalGate/>
  </CustomerShell>;
}
