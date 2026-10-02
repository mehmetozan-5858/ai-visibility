import {Shell} from "../../components/ui";
import CustomerPortal from "../../components/CustomerPortal";
export default function Page(){
  return <Shell title="Müşteri Paneli" subtitle="AI görünürlüğünüz, çalışmalarınız, rapor süreciniz ve ödemeleriniz.">
    <CustomerPortal/>
  </Shell>;
}
