'use client';
import {useEffect,useState} from 'react';
const labels={database:'Ortak kayıt bağlantısı',signingKeys:'Ajan imzalama anahtarları',registry:'Ajan yetki kaydı',adminActor:'Yönetici okuma kimliği'};
export default function AgentControlConsole(){
 const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function load(){setBusy(true);setError('');try{
  const response=await fetch('/api/command-control',{cache:'no-store'});
  const value=await response.json();if(!response.ok||!value.ok)throw Error();setData(value);
 }catch{setData(null);setError('Güncel durum alınamadı. Önceki bilgiler doğrulanmış sayılmaz.');}finally{setBusy(false);}}
 useEffect(()=>{load();},[]);
 return <section aria-label="Ortak ajan denetimi" style={{display:'grid',gap:16}}>
  <button type="button" onClick={load} disabled={busy} style={{minHeight:44}}>{busy?'Kontrol ediliyor…':'Güncel durumu oku'}</button>
  {error&&<p role="alert">{error}</p>}
  {data&&<>
   <p>Son okuma: {new Date(data.checkedAt).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul'})}</p>
   <article className="panel"><h2>Çalışma kapsamı</h2><p>İnceleme API’si: {data.control.reviewApiEnabled?'Etkinleştirilmiş':'Kapalı'}. Model çalıştırma ve otomatik yayın kapalı.</p>
    <p>Kayıt okuması: {data.control.queueStatus==='available'?'Bağlı kimliğin yetkileriyle okundu':data.control.queueStatus==='unavailable'?'Bağlantı veya yetki doğrulanamadı':'Henüz yapılandırılmadı'}.</p>
    <ul>{Object.entries(labels).map(([key,label])=><li key={key}>{label}: {data.control.configurationProvided[key]?'Ayar mevcut; tek başına çalışma kanıtı değil':'Eksik'}</li>)}</ul>
   </article>
   <article className="panel"><h2>Yetkili kapsamın görevleri</h2>
    {!data.snapshot?<p>Görev geçmişi okunmadı; sıfır görev veya tamamlanmış iş sonucu çıkarılamaz.</p>:<>
     <p>{data.snapshot.tasks.length} kayıt · {data.snapshot.audit.length} yetkili denetim olayı</p>
     {data.snapshot.tasks.length===0?<p>Okunan yetkili kapsamda görev yok.</p>:data.snapshot.tasks.map(task=><div key={task.id} style={{padding:12,borderBottom:'1px solid #345',overflowWrap:'anywhere'}}>
      <b>{task.project}</b><p>{task.id} · {task.state==='reviewed'?'İncelendi':'Sırada'}</p>
      {task.result&&<p>Açık kapılar: {task.result.openGateIds.join(', ')||'Bildirilen kayıtta açık kapı yok'}. Bağımsız doğrulama ve yayın kabulü verilmedi.</p>}
     </div>)}
    </>}
   </article>
   <p>ZERA yalnız test müşterisidir. Bu merkez proje incelemelerini gösterir; yeni müşteri hizmeti veya ücretli işlem başlatmaz.</p>
  </>}
 </section>;
}
