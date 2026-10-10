import {Shell} from "../../components/ui";
import LaunchGate from "../../components/LaunchGate";

export const metadata={title:"Lansman Kontrolü | AI Visibility",robots:{index:false,follow:false}};

export default function Page(){
  return <Shell title="Lansman Kontrolü" subtitle="Canlı yayına çıkmadan önce zorunlu teknik kapıları tek ekranda doğrulayın.">
    <LaunchGate/>
  </Shell>;
}
