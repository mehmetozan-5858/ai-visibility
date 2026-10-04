import {Shell} from "../../components/ui";
import AgentsManager from "../../components/AgentsManager";
import SalesCommandCenter from "../../components/SalesCommandCenter";
import SalesManager from "../../components/SalesManager";
import WorkManager from "../../components/WorkManager";
import PaymentsManager from "../../components/PaymentsManager";
import CRMManager from "../../components/CRMManager";
import LeadsManager from "../../components/LeadsManager";
export default function Page(){return <Shell title="Ajanlar" subtitle="Otomasyon ekibinizin durumunu ve görevlerini izleyin."><SalesCommandCenter/><AgentsManager/><LeadsManager/><CRMManager/><WorkManager/><PaymentsManager/><SalesManager/></Shell>}
