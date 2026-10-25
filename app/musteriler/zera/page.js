"use client";
import {useEffect,useState} from "react";
export default function ZeraCustomerDetail(){
 const [state,setState]=useState({loading:true,client:null,error:""});
 useEffect(()=>{let alive=true;(async()=>{try{
  const response=await fetch("/api/clients",{cache:"no-store",credentials:"same-origin"});
  if(!response.ok)throw Error("Yönetici oturumu veya müşteri listesi erişimi gerekiyor.");
  const data=await response.json();
  const client=(data.clients||[]).find(c=>c.name==="ZERA Clothing"&&c.plan==="Pilot");
  if(alive)setState({loading:false,client,error:client?"":"ZERA Production müşteri kaydı bulunamadı."});
 }catch(e){if(alive)setState({loading:false,client:null,error:e.message})}})();return()=>{alive=false}},[]);
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
     <h2>Gerçek AI ölçümü</h2>
     <p>Bu müşteri için Production ortamında doğrulanmış Gemini/Perplexity analizi henüz kaydedilmedi. Preview testindeki 7 planlı sorgu, Production ölçüm sonucu değildir.</p>
     <p>Başarısız HTTP yanıtları, marka görünürlük ölçümüne dahil edilemez. Ölçüm tamamlanmadan skor veya satış tahmini verilmez.</p>
     <p><a href="/taramalar">Taramalar bölümünü aç →</a></p>
    </section>
    <section className="panel" style={{padding:18}}>
     <h2>Sonraki aşama</h2><p>API model erişimini doğrula; maliyeti sınırlı gerçek sorguları çalıştır; ham yanıtları ve kaynak kanıtlarını bu müşteriyle ilişkilendir.</p>
    </section>
   </>}
 </main>;
}
