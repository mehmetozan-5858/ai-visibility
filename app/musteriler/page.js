import {Shell} from "../../components/ui";
import ClientsManager from "../../components/ClientsManager";
import ProspectsManager from "../../components/ProspectsManager";
import LeadsManager from "../../components/LeadsManager";
import PilotAccessManager from "../../components/PilotAccessManager";
export default function Page(){
  return <Shell title="Müşteriler" subtitle="Aday işletmeleri bulun, analiz edin ve müşteriye dönüştürün.">
    <LeadsManager/>
    <PilotAccessManager/>
    <ProspectsManager/>
    <ClientsManager/>
  </Shell>;
}
