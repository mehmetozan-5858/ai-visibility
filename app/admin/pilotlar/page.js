import Link from "next/link";
import PilotAccessManager from "../../../components/PilotAccessManager";

export const metadata = {
  title: "Ücretsiz Pilot Yönetimi | AI Visibility",
  robots: { index: false, follow: false, nocache: true }
};

export default function AdminPilotsPage() {
  return <main style={{maxWidth:900,margin:"0 auto",padding:"24px 16px 100px"}}>
    <Link href="/admin">← Yönetici paneline dön</Link>
    <h1>Ücretsiz pilot yönetimi</h1>
    <p>ZERA gibi mevcut test müşterilerinin erişimini yönetin. Bu işlem ödeme veya gelir kaydı oluşturmaz. Pilot hesap oluşturma bağlantısını yalnızca yetkili kullanıcıyla paylaşın.</p>
    <PilotAccessManager/>
  </main>;
}
