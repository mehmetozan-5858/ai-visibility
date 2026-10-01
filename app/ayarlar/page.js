import {Shell} from "../../components/ui";
import SettingsManager from "../../components/SettingsManager";
import TestCenter from "../../components/TestCenter";
export default function Page(){return <Shell title="Ayarlar" subtitle="Bağlantılar, güvenlik ve otomasyon tercihleri."><SettingsManager/><TestCenter/></Shell>}