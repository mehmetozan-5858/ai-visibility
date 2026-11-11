'use client';
import {useState} from 'react';
export default function RealAuditPage(){
 const [summary,setSummary]=useState(null),[message,setMessage]=useState('Henüz sorgulanmadı.'),[busy,setBusy]=useState(false);
 async function load(){
  setBusy(true);setSummary(null);setMessage('Salt okunur özet alınıyor…');
  try{const r=await fetch('/api/admin/rd-audit-readonly',{cache:'no-store'}),d=await r.json();
   if(!r.ok||d.ok!==true||!d.summary)throw Error();
   setSummary(d.summary);setMessage('Kayıt özeti alındı. Bu, ajanların şu anda çalıştığı anlamına gelmez.');
  }catch{setMessage('Özet alınamadı. Oturum, erişim veya veri kaynağı kontrol edilmeli; değerler bilinmiyor.');}
  finally{setBusy(false)}
 }
 return <main lang="tr" data-localized style={{maxWidth:900,margin:'auto',padding:'32px 20px'}}>
  <h1>Ar-Ge · Gerçek olayların salt okunur incelemesi</h1>
  <p>Yalnız yönetici erişimi. Son yedi günden en fazla 200 olay ve 200 maliyet kaydı özetlenir; sınır aşılırsa belirtilir.</p>
  <button onClick={load} disabled={busy}>{busy?'Okunuyor…':'Güncel özeti al'}</button>
  <p role="status">{message}</p>
  {summary&&<section className="panel" style={{padding:22}}>
   <h2>Ajan olayları</h2>
   <p>{summary.events.count} kayıt · {summary.events.completed} tamamlandı durumu · {summary.events.attention} kontrol gereken durum · {summary.events.other} diğer durum</p>
   <p>{summary.events.limited?'Örneklem sınırına ulaşıldı; tüm kayıtları temsil etmez.':'Bu zaman aralığındaki kayıtlar örneklem sınırını aşmadı.'}</p>
   <h2>Maliyet kanıtı</h2>
   <p>{summary.costs.count} kayıt · {summary.costs.estimated} tahmin işaretli · {summary.costs.unknown} maliyeti belirsiz kayıt</p>
   <p>{summary.costs.limited?'Maliyet örneklemi sınırlı. ':''}Gerçek toplam harcama bu kayıtlardan doğrulanmaz.</p>
   <p>Kontrol zamanı: {summary.checkedAt}</p>
  </section>}
  <p>Ad, e-posta, olay metni ve ham hata içeriği gösterilmez. Sorgu, salt okunur işlem içinde yalnız özet görünümünü okuyabilen role geçerek çalışır. Bağlantı mevcut uygulama hesabını kullanır; ayrı bir giriş parolası oluşturulmaz.</p>
 </main>;
}
