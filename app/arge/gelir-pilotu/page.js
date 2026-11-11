import Link from 'next/link';
import {runRevenuePilot} from '../../../lib/rd-revenue-pilot.mjs';
export const dynamic='force-dynamic';
export const metadata={title:'Ar-Ge Tahsilat Denetimi Pilotu',robots:{index:false,follow:false}};
export default function RevenuePilot(){
 const r=runRevenuePilot();
 return <main lang="tr" data-localized style={{maxWidth:900,margin:'auto',padding:'32px 20px',minHeight:'100vh'}}>
  <Link href="/arge/denetim-pilotu">Ar-Ge denetim pilotu</Link>
  <p>AR-GE · RD-04 · SENTETİK CANLI PROVA</p><h1>Tahsilat tutarlılığı denetimi</h1>
  <p>Tahsilat ve erişim kayıtlarındaki olası uyuşmazlıkları, yalnız örnek verilerle sınayan ilk pilot.</p>
  <section className="panel" style={{padding:22}}><h2>{r.passed} / {r.total} kontrol geçti</h2>
   <p role="status">{r.ok?'Sentetik prova başarılı.':'Prova başarısız; kapsam genişletilmemeli.'}</p>
   <ul style={{lineHeight:1.9}}>{r.results.map(x=><li key={x.id}>{x.passed?'Geçti':'Başarısız'} · {x.name}</li>)}</ul>
  </section>
  <h2>Kanıt sınırı</h2><p>Gerçek müşteri veya ödeme kaydı okunmaz. Eşleşen örnek kayıtlar gerçek gelir kanıtı değildir. Pilot ödeme, iade, hesap erişimi veya dış işlem başlatmaz; kurtarılan gelir iddiası üretmez.</p>
  <h2>Sonraki aşama</h2><p>Gerçek veriye geçmeden önce imzalı ödeme kabulü ve dar yetkili kaynak eşlemesi doğrulanmalı. Eksik veya tutarsız kayıtlar yalnız inceleme konusu olur; otomatik düzeltme yapılmaz.</p>
  <Link href="/api/rd/revenue-pilot">Güncel sentetik test sonucunu aç</Link>
 </main>;
}
