"use client";
import {useEffect,useState} from "react";
export default function ZeraCustomerDetail(){
 const [state,setState]=useState({loading:true,client:null,error:""});
 const [measurements,setMeasurements]=useState({loading:true,error:"",comparisons:[],verifiedCount:0});
 const [run,setRun]=useState({ready:false,loading:true,busy:false,used:false,message:""});
 const [payment,setPayment]=useState({busy:false,url:'',error:''});
 async function preparePayment(){
  if(payment.busy)return;
  setPayment({busy:true,url:'',error:''});
  try{
   const response=await fetch('/api/clients/zera-payment-link',{method:'POST',credentials:'same-origin'});
   const data=await response.json();if(!response.ok)throw Error(data.error||'Bağlantı hazırlanamadı.');
   setPayment({busy:false,url:data.paymentUrl,error:''});
  }catch(e){setPayment({busy:false,url:'',error:e.message});}
 }
 useEffect(()=>{let alive=true;(async()=>{try{
  const response=await fetch("/api/clients",{cache:"no-store",credentials:"same-origin"});
  if(!response.ok)throw Error("Yönetici oturumu veya müşteri listesi erişimi gerekiyor.");
  const data=await response.json();
  const client=(data.clients||[]).find(c=>c.name==="ZERA Clothing"&&c.plan==="Pilot");
  if(alive)setState({loading:false,client,error:client?"":"ZERA Production müşteri kaydı bulunamadı."});
 }catch(e){if(alive)setState({loading:false,client:null,error:e.message})}})();return()=>{alive=false}},[]);
 useEffect(()=>{let alive=true;(async()=>{try{
  const response=await fetch("/api/clients/zera-results",{cache:"no-store",credentials:"same-origin"});
  if(!response.ok)throw Error("Kayıtlı AI sonuçları şu anda okunamıyor.");
  const data=await response.json();
  if(alive)setMeasurements({loading:false,error:"",comparisons:data.comparisons||[],verifiedCount:data.verifiedCount||0});
 }catch(e){if(alive)setMeasurements({loading:false,error:e.message,comparisons:[],verifiedCount:0})}})();return()=>{alive=false}},[]);
 useEffect(()=>{let alive=true;(async()=>{try{
  const [a,b]=await Promise.all([fetch("/api/clients/zera-scan-readiness",{credentials:"same-origin",cache:"no-store"}),fetch("/api/clients/zera-ai-runner",{credentials:"same-origin",cache:"no-store"})]);
  if(!a.ok||!b.ok)throw Error("Hazırlık durumu okunamadı");
  const readiness=await a.json(),history=await b.json();
  if(alive)setRun({ready:readiness.ready===true,loading:false,busy:false,used:(history.attempts||[]).length>0,message:(history.attempts||[]).length>0?"AI görev durumu: "+history.tasks.map(t=>t.id+" "+t.status).join(", "):readiness.ready?"İki Gemini sorgusu tek onayla sırayla çalıştırılabilir.":"Tarama güvenlik kilidi kapalı; API çağrısı yapılmadı."});
 }catch{if(alive)setRun({ready:false,loading:false,busy:false,used:false,message:"Hazırlık durumu şu anda kontrol edilemiyor."})}})();return()=>{alive=false}},[]);
 async function startOneScan(){if(!run.ready||run.used||run.busy)return;
  setRun(v=>({...v,busy:true,message:"Gemini görevleri sırayla çalışıyor…"}));
  try{const response=await fetch("/api/clients/zera-ai-runner",{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({confirmTwoFreeGeminiTasks:true})});const data=await response.json();
   setRun(v=>({...v,busy:false,used:true,ready:false,message:response.ok?(()=>{const items=data.results||[];const failed=items.find(r=>r.status!=="stored");if(failed)return "Görev "+failed.taskId+": "+(failed.stage==="storage"?"Gemini yanıtı alındı fakat veritabanına kaydedilemedi":failed.stage==="attempt-status"?"Yanıt kaydedildi; işlem durumu eşleştirme gerektiriyor":failed.stage==="provider"?"Gemini yanıtı alınamadı":"İşlem tamamlanamadı")+" ("+(failed.reason||failed.status)+"). Tekrar çağrı yapılmayacak.";return items.some(r=>r.status==="stored")?"AI yanıtları kaydedildi. Sonuçları görmek için sayfayı yenile.":"Görev sonucu belirsiz; kayıtlar kontrol edilmeli."})():"Tarama sonucu: "+(data.error||data.status||"Hata")+"; otomatik tekrar denenmeyecek."}));
  }catch{setRun(v=>({...v,busy:false,used:true,ready:false,message:"Bağlantı kesildi; kayıt kontrol edilmeden yeniden denemeyin."}))}
 }
 return <main style={{maxWidth:820,margin:"36px auto",padding:20,lineHeight:1.6}}>
  <a href="/musteriler">← Müşteriler</a>
  <h1>ZERA Clothing</h1><p>Production müşteri profili · Wetzlar, Germany</p>
  {state.loading?<p>Doğrulanmış müşteri kaydı yükleniyor…</p>:state.error?<p role="alert">{state.error}</p>:<>
    <section className="panel" style={{padding:18,marginBottom:16}}>
     <h2>Müşteri profili</h2>
     <p><b>Durum:</b> {state.client.status==="active"?"Aktif":state.client.status} · <b>Paket:</b> {state.client.plan}</p>
     <p><b>Sektör:</b> {state.client.profile?.sector||"Belirlenmedi"} · <b>Konum:</b> {state.client.profile?.city||"Wetzlar"}, {state.client.profile?.country||"Germany"}</p>
     <p><b>Web sitesi:</b> {state.client.domain||"Henüz doğrulanmadı"}</p>
    </section>
    <section className="panel" style={{padding:18,marginBottom:16}}>
     <h2>Ödeme bağlantısı</h2>
     <p>ZERA için İlk Ölçüm paketi bağlantısını hazırla. Ödeme ekranında tutarı kontrol et; ödeme tamamlandığında gerçek tahsilat yapılır.</p>
     <button type="button" disabled={payment.busy} onClick={preparePayment}>{payment.busy?'Hazırlanıyor…':'Ödeme bağlantısı hazırla'}</button>
     {payment.error&&<p role="alert">{payment.error}</p>}
     {payment.url&&<p><a href={payment.url}>Ödeme ekranını aç</a> · Bağlantı bir saat geçerlidir.</p>}
    </section>
    <section className="panel" style={{padding:18,marginBottom:16}}>
     <h2>Gerçek AI ölçümü</h2>
     {measurements.loading?<p>Kaydedilmiş AI sonuçları okunuyor…</p>:measurements.error?<p role="alert">{measurements.error}</p>:<>
      <p><b>Kaydedilmiş karşılaştırma:</b> {measurements.comparisons.length} · <b>Kaynak destekli yanıt:</b> {measurements.verifiedCount}</p>
      {measurements.comparisons.length===0?<p>Production ortamında henüz kayıtlı AI karşılaştırması yok. Preview testindeki 7 planlı sorgu, Production ölçüm sonucu değildir.</p>:
       <ul>{measurements.comparisons.map(row=><li key={row.id} style={{marginBottom:12}}><b>{row.query}</b><ul>{row.results.map((result,index)=><li key={result.provider+"-"+index}>{result.provider}: {result.status} · {result.verified?"Kaynak destekli":"Doğrulanmamış"}{result.sourceUrl?<span> · <a href={result.sourceUrl} target="_blank" rel="noopener noreferrer">Kaynak</a></span>:null}</li>)}</ul></li>)}</ul>}
     </>}
     <p>Başarısız HTTP yanıtları, marka görünürlük ölçümüne dahil edilemez. Ölçüm tamamlanmadan skor veya satış tahmini verilmez.</p>
     <p><a href="/taramalar">Taramalar bölümünü aç →</a></p>
    </section>
    <section className="panel" style={{padding:18,marginBottom:16}}>
     <h2>İki AI görevini sırayla çalıştır</h2>
     <p>{run.loading?"Güvenlik koşulları kontrol ediliyor…":run.message}</p>
     <button disabled={run.loading||run.busy||run.used||!run.ready} onClick={startOneScan} style={{padding:"12px 18px",borderRadius:9,cursor:run.ready&&!run.used?"pointer":"not-allowed"}}>{run.busy?"Çalışıyor…":"ZERA Gemini görevlerini tek onayla çalıştır"}</button>
     <p style={{fontSize:13}}>Bu işlem en fazla iki Gemini API çağrısı yapar, ilk hatada durur ve otomatik tekrar denemez. Google arama görevleri bu çalıştırıcıya dahil değildir. Ücretli grounding, Perplexity ve OpenAI çağrıları kapalıdır.</p>
    </section>
    <section className="panel" style={{padding:18}}>
     <h2>Sonraki aşama</h2><p>API model erişimini doğrula; maliyeti sınırlı gerçek sorguları çalıştır; ham yanıtları ve kaynak kanıtlarını bu müşteriyle ilişkilendir.</p>
    </section>
   </>}
 </main>;
}
