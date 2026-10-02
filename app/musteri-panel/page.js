import CustomerShell from "../../components/CustomerShell";
import CustomerPortal from "../../components/CustomerPortal";
export default function Page(){
  return <CustomerShell title="Müşteri Paneli" subtitle="AI görünürlüğünüz, çalışmalarınız, rapor süreciniz ve ödemeleriniz.">
    <CustomerPortal/>
  </CustomerShell>;
}
