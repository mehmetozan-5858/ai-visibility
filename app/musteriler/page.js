import {Shell} from "../../components/ui";
import ClientsManager from "../../components/ClientsManager";
import ProspectsManager from "../../components/ProspectsManager";
import ClientAccountManager from "../../components/ClientAccountManager";
export default function Page(){
  return <Shell title="Müşteriler" subtitle="Aday işletmeleri bulun, analiz edin ve müşteriye dönüştürün.">
    <ProspectsManager/>
    <ClientsManager/>
    <ClientAccountManager/>
  </Shell>;
}