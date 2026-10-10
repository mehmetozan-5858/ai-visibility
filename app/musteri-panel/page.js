import CustomerShell from "../../components/CustomerShell";
import CustomerPortalGate from "../../components/CustomerPortalGate";

export const metadata={
  title:"Müşteri Paneli",
  robots:{index:false,follow:false,nocache:true},
  referrer:"no-referrer"
};

export default function Page(){
  return <CustomerShell title="Müşteri Paneli" subtitle="AI görünürlüğünüz, çalışmalarınız, rapor süreciniz ve ödemeleriniz.">
    <CustomerPortalGate/>
  </CustomerShell>;
}
