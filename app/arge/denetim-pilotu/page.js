import Link from 'next/link';
import {runAuditPilot} from '../../../lib/rd-audit-pilot.mjs';
export const dynamic='force-dynamic';
export const metadata={title:'Ar-Ge Denetim Pilotu',robots:{index:false,follow:false}};
export default function AuditPilotPage(){
 const result=runAuditPilot();
 return <main lang="tr" data-localized style={{maxWidth:900,margin:'auto',padding:'32px 20px',minHeight:'100vh'}}>
  <Link href="/">AI Visibility Works</Link>
  <p>AR-GE · RD-03 · SINIRLI CANLI PİLOT</p>
  <h1>Ajan denetimi: ilk prova</h1>
  <p>Yayın kanıtı ve kimlik kuralları, bu sayfa açıldığında yalnız sentetik örneklerle kontrol edilir.</p>
  <section className="panel" style={{padding:22}}>
   <h2>{result.passed} / {result.total} kontrol geçti</h2>
   <p role="status">{result.ok?'Sentetik prova başarılı.':'Prova başarısız; kapsam genişletilmemeli.'}</p>
   <ul style={{lineHeight:1.9}}>{result.results.map(r=><li key={r.id}>{r.passed?'Geçti':'Başarısız'} · {r.name}</li>)}</ul>
  </section>
  <h2>Bu aşamanın kapsamı</h2>
  <p>Müşteri verisi okunmaz, ücretli model çağrılmaz ve dış işlem yapılmaz. Hazırlanan olaylar kalıcı günlüğe yazılmaz. Bu sonuç gerçek ajanların izlendiği veya ana uygulamaların tüm kabul kapılarının kapandığı anlamına gelmez.</p>
  <h2>Sonraki aşama</h2>
  <p>Bu pilot doğrulandıktan sonra dar yetkili, salt okunur gerçek olay incelemesi değerlendirilecek. Gerçek veri bağlantısı ve kalıcı kayıt bu aşamada etkin değildir.</p>
  <p><Link href="/api/rd/audit-pilot">Pilotun güncel kontrol sonucunu aç</Link></p>
  <p><Link href="/arge/gercek-olaylar">Yönetici: gerçek olayların salt okunur incelemesi</Link></p>
 </main>;
}
