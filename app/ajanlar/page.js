import {Shell} from "../../components/ui";
import AgentsManager from "../../components/AgentsManager";
import SalesManager from "../../components/SalesManager";
import WorkManager from "../../components/WorkManager";
import PaymentsManager from "../../components/PaymentsManager";
export default function Page(){return <Shell title="Ajanlar" subtitle="Otomasyon ekibinizin durumunu ve görevlerini izleyin."><AgentsManager/><WorkManager/><PaymentsManager/><SalesManager/></Shell>}