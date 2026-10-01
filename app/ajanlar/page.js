import {Shell} from "../../components/ui";
import AgentsManager from "../../components/AgentsManager";
import SalesManager from "../../components/SalesManager";
export default function Page(){return <Shell title="Ajanlar" subtitle="Otomasyon ekibinizin durumunu ve görevlerini izleyin."><AgentsManager/><SalesManager/></Shell>}