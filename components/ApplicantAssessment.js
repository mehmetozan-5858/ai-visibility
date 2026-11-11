"use client";
import {useEffect,useState} from "react";
export default function ApplicantAssessment(){
 const [value,setValue]=useState(null),[message,setMessage]=useState(""),[busy,setBusy]=useState(true);
 useEffect(()=>{
  const controller=new AbortController();
  const token=new URLSearchParams(window.location.hash.slice(1)).get("token");
  // Keep bearer token in the fragment, never query string, logs or link previews.
  if(!token){setMessage("Güvenli analiz bağlantısı gerekli. / A secure assessment link is required.");setBusy(false);return()=>controller.abort();}
  fetch("/api/applicant-assessment",{headers:{"x-applicant-assessment-token":token},cache:"no-store",signal:controller.signal})
   .then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.error||"Assessment unavailable");return data;})
   .then(data=>setValue(data)).catch(e=>{if(e.name!=="AbortError")setMessage(e.message);})
   .finally(()=>{if(!controller.signal.aborted)setBusy(false);});
  return()=>controller.abort();
 },[]);
 const en=value?.language==="en",a=value?.assessment;
 const missing=a&&Number.isInteger(a.samples)&&Number.isInteger(a.providers)&&Number.isInteger(a.queries)?{samples:Math.max(0,6-a.samples),providers:Math.max(0,2-a.providers),queries:Math.max(0,2-a.queries)}:null;
 const measuredAt=a?.measuredAt&&Number.isFinite(Date.parse(a.measuredAt))?new Date(a.measuredAt).toLocaleString(en?"en-GB":"tr-TR",{timeZone:"Europe/Istanbul"}):null;
 const scoreReady=a?.status==="ready"&&Number.isInteger(a.score)&&a.score>=0&&a.score<=100&&
  Number.isInteger(a.samples)&&a.samples>=6&&Number.isInteger(a.providers)&&a.providers>=2&&
  Number.isInteger(a.queries)&&a.queries>=2;
 return <main style={{maxWidth:780,margin:"0 auto",padding:"32px 20px 80px"}}>
  <a href="/">AI Visibility Works</a>
  <h1>{en?"Your free AI assessment":"Ücretsiz AI ön değerlendirmeniz"}</h1>
  {busy&&<p role="status">Kayıtlı yanıtlar yükleniyor… / Loading recorded evidence…</p>}
  {message&&<p role="alert">{message}</p>}
  {value&&<section className="panel">
   <h2>{value.business.name}</h2>
   <p>{[value.business.city,value.business.country,value.business.sector].filter(Boolean).join(" · ")}</p>
   <h3>{en?"Recorded answer match":"Kaydedilmiş yanıt eşleşmesi"}</h3>
   {scoreReady?<p style={{fontSize:44,fontWeight:800}}>{a.score}/100</p>:
     <p>{en?"Not enough eligible observations yet; no score is displayed.":"Henüz yeterli ölçüm bulunmuyor; skor gösterilmiyor."}</p>}
   <p>{a.samples} {en?"samples":"örnek"} · {a.providers} {en?"providers":"sağlayıcı"} · {a.queries} {en?"questions":"sorgu"}</p>
   {measuredAt?<p>{en?"Latest eligible recorded sample":"Son uygun kayıtlı yanıt"}: <time>{measuredAt}</time> ({en?"Türkiye time":"Türkiye saati"})</p>:<p>{en?"No verified sample date available.":"Doğrulanmış örnek tarihi bulunmuyor."}</p>}
   {!scoreReady&&missing&&<p role="status">{en?"Additional eligible evidence needed":"Gerekli ek uygun kanıt"}: {missing.samples} {en?"samples":"örnek"}, {missing.providers} {en?"providers":"sağlayıcı"}, {missing.queries} {en?"different questions":"farklı sorgu"}.</p>}
   <p>{en?"What happens next:":"Sonraki aşama:"} {en?"Verified ownership and consent, evidence-backed measurement, then an optional detailed report. No new AI call is triggered by viewing this page.":"İşletme sahipliği ve onayın doğrulanması, kanıtlı ölçüm, ardından isteğe bağlı ayrıntılı rapor. Bu sayfayı açmak yeni AI isteği başlatmaz."}</p>
   <small>{en?"This measures a limited set of recorded model responses, not general market visibility or guaranteed sales.":"Bu yalnızca sınırlı sayıdaki kayıtlı model yanıtlarını ölçer; genel görünürlük veya satış garantisi değildir."}</small>
   <p>{en?"Detailed reports, service access and payments require separate verification.":"Detaylı rapor, hizmet erişimi ve ödeme ayrı doğrulama gerektirir."}</p>
   <a href="/hizmetler">{en?"Explore services":"Hizmetleri incele"}</a>
  </section>}
 </main>;
}
