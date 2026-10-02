import {Shell} from "../../components/ui";
import ClientAccountManager from "../../components/ClientAccountManager";
export default function Page(){
  return <Shell title="İşletme Hesabı" subtitle="Her işletmenin temas, rapor, uygulama, ödeme ve önce/sonra kanıt geçmişi.">
    <ClientAccountManager/>
  </Shell>;
}