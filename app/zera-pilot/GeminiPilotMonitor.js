'use client';
import {useState} from 'react';
export default function GeminiPilotMonitor(){
 const [status,setStatus]=useState(null),[busy,setBusy]=useState(false),[modelCheck,setModelCheck]=useState(null);
 async function checkModels(){setBusy(true);try{const r=await fetch('/api/zera-pilot/gemini-models',{cache:'no-store',credentials:'same-origin'});setModelCheck(await r.json())}catch{setModelCheck({error:'Model bağlantısı kontrol edilemedi'})}finally{setBusy(false)}}
 async function readStatus(){
  setBusy(true);
  try{
   const response=await fetch('/api/zera-pilot/gemini-first-scan',{credentials:'same-origin',cache:'no-store'});
   setStatus(await response.json());
  }catch{setStatus({error:'Durum okunamadı'})}finally{setBusy(false)}
 }
 async function runOnce(){
  if(busy||(['completed','response-recorded','attempt-started'].includes(status?.status)||(status?.status==='failed'&&status?.attemptId==='ZERA-GEMINI-RETRY-1')))return;
  setBusy(true);
  try{
   const response=await fetch('/api/zera-pilot/gemini-first-scan',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({confirmSingleGeminiScan:true})});
   const result=await response.json();
   if(!response.ok){setStatus({error:result.error||'Tarama başlatılamadı',httpStatus:response.status});return;}
   setStatus({status:result.comparison?.results?.some(r=>r.status==='failed')?'failed':'response-recorded',attemptId:'ZERA-GEMINI-RETRY-1',comparison:result.comparison});
  }catch{setStatus({error:'Bağlantı hatası; yeniden denemeden önce durum kontrolü yapın'})}finally{setBusy(false)}
 }
 const result=status?.comparison?.results?.[0];
 return <section style={{border:'1px solid #cbd5e1',padding:16,borderRadius:12,marginBottom:14}}>
  <h2>Gerçek Gemini pilot izlemesi</h2>
  <p>İlk test tek sorguyla sınırlandırılmıştır. Tekrar çalıştırma otomatik engellenir. Sonuçlar kaydedilerek gözden geçirilir.</p>
  <button type="button" disabled={busy} onClick={checkModels} style={{padding:10,marginRight:8}}>Gemini model erişimini kontrol et</button>
  <button type="button" disabled={busy} onClick={readStatus} style={{padding:10,marginRight:8}}>Kaydedilmiş sonucu kontrol et</button>
  <button type="button" disabled={busy||(['completed','response-recorded','attempt-started'].includes(status?.status)||(status?.status==='failed'&&status?.attemptId==='ZERA-GEMINI-RETRY-1'))} onClick={runOnce} style={{padding:10}}>{status?.status==='failed'?'Başarısız ilk denemeyi bir kez tekrar et':'İlk tek sorguyu başlat'}</button>
  {modelCheck&&<p role="status">Google API: {modelCheck.connected?"Bağlantı doğrulandı":"Erişim doğrulanamadı"} · Seçili model: {modelCheck.configuredModel||"bilinmiyor"} · Model erişimi: {modelCheck.models?.includes(modelCheck.configuredModel)?"Mevcut":"Doğrulanmadı"} · Yeni tarama: hayır</p>}
  {busy&&<p role="status">İşlem sürüyor…</p>}
  {status?.error&&<p role="alert">{status.error} {status.httpStatus||''}</p>}
  {status?.status&&<p role="status">Tarama durumu: {status.status==='failed'?'Başarısız deneme kaydedildi':status.status==='response-recorded'?'Yanıt kaydedildi':status.status==='attempt-started'?'Deneme başlatıldı':status.status}</p>}
  {result&&<div><p>Sağlayıcı: {result.provider} · Yanıt durumu: {result.status} · Marka: {result.brandMention||'bilinmiyor'}</p><p>Kaynak desteği: {result.verified?'Var':'Doğrulanamadı'}</p>{result.evidence?.sourceUrl&&<p><a href={result.evidence.sourceUrl} target="_blank" rel="noopener noreferrer">Kaynak bağlantısı</a></p>}<p style={{whiteSpace:'pre-wrap'}}>{result.answer||result.reason||'Yanıt alınmadı'}</p><small>Bu sonuç, marka sıralaması veya satış artışının kanıtı değildir.</small></div>}
 </section>;
}
