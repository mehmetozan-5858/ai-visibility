"use client";
import {useState} from 'react';
export default function ApplicantIntakeConsole(){
 const [leadId,setLeadId]=useState(''),[business,setBusiness]=useState(null),[challenge,setChallenge]=useState(null),[verified,setVerified]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function run(action){
  setBusy(true);setMessage('');
  try{
   const prepare=action==='prepare';
   if(action==='preview'){
    const response=await fetch('/api/admin/applicant-assessment-grant',{method:'POST',headers:{'content-type':'application/json'},cache:'no-store',body:JSON.stringify({leadId})});
    const data=await response.json();
    if(!response.ok||!data.ok||typeof data.token!=='string'||!data.token||data.token.length>350)throw Error('Sonuç erişimi açılamadı. E-posta ve alan adı doğrulamasını kontrol edin.');
    window.location.replace('/basvuru-analiz#token='+encodeURIComponent(data.token));
    return;
   }
   const response=await fetch(prepare?'/api/admin/applicant-intake':'/api/admin/applicant-domain-proof',{method:'POST',headers:{'content-type':'application/json'},cache:'no-store',body:JSON.stringify(prepare?{leadId,confirm:'prepare-applicant-business'}:{action,leadId,prospectId:business.prospectId})});
   const data=await response.json();if(!response.ok)throw Error(data.error||data.reason||'İşlem tamamlanamadı.');
   if(prepare){if(!data.prospectId)throw Error('İşletme referansı alınamadı.');setBusiness(data);setChallenge(null);setVerified(false);setMessage(data.created?'İşletme kaydı oluşturuldu. Sahiplik henüz doğrulanmadı.':'Mevcut işletme kaydı bulundu. Sahiplik ayrıca doğrulanmalıdır.');}
   else if(action==='issue'){if(!data.challenge?.record||!data.challenge?.value)throw Error('DNS kaydı alınamadı.');setChallenge(data.challenge);setVerified(false);setMessage('TXT kaydını alan adının DNS yönetimine ekleyin. Kayıt 24 saat geçerlidir.');}
   else if(data.verified===true){setVerified(true);setMessage('Alan adı sahipliği doğrulandı. Analiz ve sonuç erişimi ayrıca hazırlanmalıdır.');}
   else throw Error('Sahiplik doğrulanmadı.');
  }catch(error){setMessage(error.message)}finally{setBusy(false)}
 }
 return <section className="panel" style={{padding:20,overflowWrap:'anywhere'}}>
  <h2>Başvurudan işletme sahipliği doğrulamasına</h2>
  <p>Doğrulanmış başvuruyu işletme kaydıyla eşleştirin, ardından gerçek DNS TXT kanıtını kontrol edin. Bu işlemler e-posta göndermez, müşteri hesabı açmaz veya AI taraması başlatmaz.</p>
  <form className="client-form" onSubmit={event=>{event.preventDefault();run('prepare')}}>
   <label>Başvuru referansı<input required value={leadId} disabled={busy} onChange={event=>{setLeadId(event.target.value.trim());setBusiness(null);setChallenge(null);setVerified(false);setMessage('')}} pattern="[0-9a-fA-F-]{36}" style={{fontSize:18,minHeight:48}}/></label>
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
  {business&&verified&&<div style={{marginTop:20}}>
   <h3>Ücretsiz sonuç önizlemesi</h3>
   <p>Yalnız bu başvurunun kayıtlı ölçümlerini açar. Veri yetersizse skor gösterilmez; AI çağrısı, ödeme veya e-posta başlatılmaz. Erişim 15 dakika geçerlidir.</p>
   <button disabled={busy} type="button" onClick={()=>run('preview')}>Bu başvurunun sonuç ekranını aç</button>
  </div>}
  {busy&&<p role="status">İşleniyor…</p>}
  {message&&<p role="status" aria-live="polite">{message}</p>}
 </section>;
}
