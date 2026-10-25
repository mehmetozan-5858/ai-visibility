'use client';
import {useState} from 'react';
export default function RegisterPilotButton(){
 const [result,setResult]=useState('');
 const [busy,setBusy]=useState(false);
 async function register(){
  if(busy)return;
  setBusy(true);setResult('');
  try{
   const response=await fetch('/api/zera-pilot/register',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({pilotId:'ZERA-DE-001',confirmPublicPilot:true})});
   const data=await response.json();
   setResult(response.ok?'ZERA kaydedildi. Kuyruktaki sorgu: '+data.queuedQueries+'. Ücretli tarama başlamadı.':(data.error||'Kayıt başarısız')+' ('+response.status+')');
  }catch{setResult('Bağlantı hatası. Veriler kaydedilmiş olabilir; yeniden denemeden önce kontrol edin.');}
  finally{setBusy(false);}
 }
 return <section style={{padding:16,border:'1px solid #d1d5db',borderRadius:12,marginBottom:12}}><h2>ZERA pilot kaydı</h2><p>Yalnızca yönetici hesabınızla ZERA kaydını ve 7 sorguluk kuyruğu oluşturur. AI sağlayıcılarını çağırmaz.</p><button type="button" disabled={busy} onClick={register} style={{padding:12,borderRadius:8,cursor:'pointer'}}>{busy?'Kaydediliyor…':'ZERA kaydını oluştur'}</button><p role="status">{result}</p></section>;
}