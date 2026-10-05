import {Shell} from "../../components/ui";
import ReportsManager from "../../components/ReportsManager";
import ExecutiveDailyReport from "../../components/ExecutiveDailyReport";
export default function Page(){return <Shell title="Raporlar" subtitle="Görünürlük değişimini, bulguları, ajan çalışmalarını ve çözüm fırsatlarını izleyin."><div style={{display:"grid",gap:16}}><ExecutiveDailyReport/><ReportsManager/></div></Shell>}
