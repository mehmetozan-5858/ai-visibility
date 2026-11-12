"use client";
import {useState} from 'react';
export default function ApplicantIntakeConsole(){
 const [freeStatus,setFreeStatus]=useState(null),[queries,setQueries]=useState('');
 const [leadId,setLeadId]=useState(''),[business,setBusiness]=useState(null),[challenge,setChallenge]=useState(null),[verified,setVerified]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function run(action){
  setBusy(true);setMessage('');
  try{
   const prepare=action==='prepare';
   if(action==='preflight'){
    const response=await fetch('/api/admin/free-provider-preflight',{cache:'no-store'}),data=await response.json();
    if(!response.ok)throw Error('Bağlantı kontrolü tamamlanamadı; ölçüm başlatılmadı.');
    const states={'credential-and-price-confirmed':'Anahtar ve modelin sıfır katalog fiyatı doğrulandı. Kota ve gerçek yanıt ayrıca denetlenmelidir.','credential-rejected':'OpenRouter anahtarı kabul etmedi. Production ortamına gerçek OpenRouter API anahtarını Secret olarak kaydedin.','not-configured':'Ücretsiz bağlantı ayarları eksik.','model-not-verified-free':'Model sıfır fiyatlı olarak doğrulanamadı; model çağrılmadı.'};
    setMessage((states[data.state]||'Sağlayıcı kontrolü tamamlanamadı; ölçüm başlatılmadı.')+(data.providerStatus?' HTTP '+data.providerStatus+'.':'')+' Bu kontrol AI yanıtı üretmez.');return;
   }
   if(action==='measure'){
    const response=await fetch('/api/answer-evidence',{method:'POST',headers:{'content-type':'application/json'},cache:'no-store',body:JSON.stringify({entityType:'prospect',entityId:business.prospectId,freeOnly:true,language:'tr',queries:queries.split('\n').map(x=>x.trim()).filter(Boolean)})});
    const data=await response.json();
    if(!response.ok)throw Error(data.error||(data.run?.skipped?'Ölçüm bekliyor; yeni çağrı yapılmadı.':'Ölçüm tamamlanamadı.'));
    const summary=data.run?.result?.summary;
    if(!summary)throw Error('Ölçüm sonucu doğrulanamadı.');
    const reasons=[...new Set((data.run.result.errors||[]).map(x=>[x.reason,x.providerStatus?'HTTP '+x.providerStatus:''].filter(Boolean).join(' ')).filter(Boolean))].join(' · ');
    const limited=(data.run.result.errors||[]).find(x=>x.providerStatus===429);
    const limitLabels={'openrouter_free_tier_per_minute':'OpenRouter dakika kotası','openrouter_free_tier_per_day':'OpenRouter günlük kotası','upstream_provider_shared_pool':'Model sağlayıcısının ortak kapasite sınırı'};
    const skipped=(data.run.result.errors||[]).some(x=>x.reason==='skipped-after-rate-limit');
    const limitNote=limited?` ${limitLabels[limited.limitSource]||'Ücretsiz sağlayıcının istek sınırı; hangi katmanda olduğu bildirilmedi'}. ${skipped?'Kalan sorgular gönderilmedi. ':'Ölçüm sonlandırıldı. '}Otomatik tekrar yok.${Number.isInteger(limited.retryAfterSeconds)?' Sağlayıcı en az '+limited.retryAfterSeconds+' saniye beklemeyi bildirdi; uygulamanın 15 dakika kuralı da geçerlidir.':''}`:'';
    setMessage(`${summary.successful} yanıt kaydedildi; ${summary.neutralComplete} tam ve tarafsız örnek; ${summary.failed} hata veya gönderilmemiş sorgu. Tek sağlayıcı skora yetmez. Sonuç ekranından kayıtlı kanıtı inceleyebilirsiniz.${limitNote}${reasons?' Hata sınıfı: '+reasons:''}`);
    return;
   }
   if(action==='preview'){
    const response=await fetch('/api/admin/applicant-assessment-grant',{method:'POST',headers:{'content-type':'application/json'},cache:'no-store',body:JSON.stringify({leadId})});
    const data=await response.json();
    if(!response.ok||!data.ok||typeof data.token!=='string'||!data.token||data.token.length>350)throw Error('Sonuç erişimi açılamadı. E-posta ve alan adı doğrulamasını kontrol edin.');
    window.location.replace('/basvuru-analiz#token='+encodeURIComponent(data.token));
    return;
   }
   const response=await fetch(prepare?'/api/admin/applicant-intake':'/api/admin/applicant-domain-proof',{method:'POST',headers:{'content-type':'application/json'},cache:'no-store',body:JSON.stringify(prepare?{leadId,confirm:'prepare-applicant-business'}:{action,leadId,prospectId:business.prospectId})});
   const data=await response.json();if(!response.ok)throw Error(data.error||data.reason||'İşlem tamamlanamadı.');
   if(prepare){if(!data.prospectId)throw Error('İşletme referansı alınamadı.');setBusiness(data);setFreeStatus(null);setChallenge(null);setVerified(false);setMessage(data.created?'İşletme kaydı oluşturuldu. Sahiplik henüz doğrulanmadı.':'Mevcut işletme kaydı bulundu. Sahiplik ayrıca doğrulanmalıdır.');
    try{const statusResponse=await fetch('/api/answer-evidence?entityType=prospect&entityId='+encodeURIComponent(data.prospectId),{cache:'no-store'});const statusData=await statusResponse.json();if(statusResponse.ok)setFreeStatus(statusData.freeMeasurement||null);}catch{setFreeStatus(null)}
   }
   else if(action==='issue'){if(!data.challenge?.record||!data.challenge?.value)throw Error('DNS kaydı alınamadı.');setChallenge(data.challenge);setVerified(false);setMessage('TXT kaydını alan adının DNS yönetimine ekleyin. Kayıt 24 saat geçerlidir.');}
   else if(data.verified===true){setVerified(true);setMessage('Alan adı sahipliği doğrulandı. Analiz ve sonuç erişimi ayrıca hazırlanmalıdır.');}
   else throw Error('Sahiplik doğrulanmadı.');
  }catch(error){setMessage(error.message)}finally{setBusy(false)}
 }
 return <section className="panel" style={{padding:20,overflowWrap:'anywhere'}}>
  <h2>Başvurudan işletme sahipliği doğrulamasına</h2>
  <p>Doğrulanmış başvuruyu işletme kaydıyla eşleştirin, ardından gerçek DNS TXT kanıtını kontrol edin. Bu işlemler e-posta göndermez, müşteri hesabı açmaz veya AI taraması başlatmaz.</p>
  <form className="client-form" onSubmit={event=>{event.preventDefault();run('prepare')}}>
   <label>Başvuru referansı<input required value={leadId} disabled={busy} onChange={event=>{setLeadId(event.target.value.trim());setBusiness(null);setFreeStatus(null);setQueries('');setChallenge(null);setVerified(false);setMessage('')}} pattern="[0-9a-fA-F-]{36}" style={{fontSize:18,minHeight:48}}/></label>
   <button disabled={busy||!leadId} type="submit">İşletme kaydını hazırla</button>
  </form>
  {business&&<div><p>Alan adı: <strong>{business.domain}</strong></p><p>İşletme referansı: {business.prospectId}</p>
   <button disabled={busy||verified} type="button" onClick={()=>run('issue')}>{challenge?'Yeni DNS kaydı oluştur':'DNS doğrulama kaydı oluştur'}</button>
   {challenge&&<div><dl><dt>Tür</dt><dd>TXT</dd><dt>Kayıt adı</dt><dd>{challenge.record}</dd><dt>Değer</dt><dd>{challenge.value}</dd></dl>
    <p>Yeni kayıt oluşturmak önceki doğrulanmamış kaydı geçersiz kılar. DNS yayılımından sonra kontrol edin.</p>
   </div>}
   <p>TXT kaydını daha önce eklediyseniz yeni kayıt oluşturmadan kontrol edebilirsiniz.</p>
   <button disabled={busy||verified} type="button" onClick={()=>run('verify')}>DNS kaydını kontrol et</button>
  </div>}
  {business&&<div style={{marginTop:20}}>
   <h3>Yalnız ücretsiz gerçek ölçüm</h3>
   <p>En fazla iki markasız sorgu, tek OpenRouter modeli. Her istekten önce katalog fiyatı sıfır olmalıdır; ücretli modele geçiş ve otomatik tekrar yoktur. Tamamlanmayan yanıtlar uygun örnek sayılmaz. Bu yol tek sağlayıcı sayılır; tek başına skor üretmez.</p>
   {!freeStatus?<p>Ücretsiz bağlantı durumu alınamadı; ölçüm kapalı.</p>:<p>{freeStatus.ready?'Bağlantı tanımlı; sıfır fiyat her istekte yeniden kontrol edilecek.':[!freeStatus.enabled&&'Ücretsiz ölçüm etkin değil.',!freeStatus.serverKeyConfigured&&'Sunucu anahtarı tanımlı değil.',!freeStatus.modelConfigured&&'Ücretsiz model seçilmemiş.'].filter(Boolean).join(' ')}</p>}
   <button disabled={busy||!freeStatus?.ready} type="button" onClick={()=>run('preflight')}>Ücretsiz bağlantıyı AI çağrısı yapmadan denetle</button>
   <label>Markasız ölçüm sorguları (her satıra bir sorgu, en fazla iki)<textarea rows={4} maxLength={1001} value={queries} disabled={busy} onChange={event=>setQueries(event.target.value)} placeholder="Sektör ve konumu belirtin; marka veya alan adını yazmayın."/></label>
   <button disabled={busy||!freeStatus?.ready||!queries.trim()} type="button" onClick={()=>run('measure')}>Yalnız ücretsiz yanıt örneği topla</button>
   <h3>Ücretsiz sonuç önizlemesi</h3>
   <p>Sunucu mevcut e-posta ve alan adı doğrulamasını yeniden denetler; yalnız bu başvurunun kayıtlı ölçümlerini açar. Veri yetersizse skor gösterilmez; AI çağrısı, ödeme veya e-posta başlatılmaz. Erişim 15 dakika geçerlidir.</p>
   <button disabled={busy} type="button" onClick={()=>run('preview')}>Bu başvurunun sonuç ekranını aç</button>
  </div>}
  {busy&&<p role="status">İşleniyor…</p>}
  {message&&<p role="status" aria-live="polite">{message}</p>}
 </section>;
}
