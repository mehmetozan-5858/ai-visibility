"use client";
import {useEffect,useState} from "react";
function fmt(v){if(!v)return "-";try{return new Date(v).toLocaleString("tr-TR")}catch{return String(v)}}
export default function SystemHealthMap(){
 const [data,setData]=useState(null),[error,setError]=useState("");
 const load=()=>fetch("/api/system-health-map",{cache:"no-store"}).then(async r=>{if(!r.ok)throw new Error((await r.json().catch(()=>({}))).error||"Yüklenemedi");return r.json()}).then(x=>{setData(x);setError("")}).catch(e=>setError(e.message));
 useEffect(()=>{load();const id=setInterval(load,60000);return()=>clearInterval(id)},[]);
 const items=data?.components||[];
 const label=x=>({healthy:"ÇALIŞIYOR",warning:"UYARI",delayed:"GECİKMİŞ",critical:"KRİTİK",quarantined:"KARANTİNA"}[x]||x);
 return <section className="panel" style={{marginBottom:18}}>
  <div style={{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}><div><h2 style={{marginTop:0}}>Mega Makine Health Map</h2><p style={{opacity:.72,marginBottom:0}}>Kritik motorların canlılık, gecikme ve karantina durumu.</p></div><button onClick={load}>Yenile</button></div>
  {error?<p style={{color:"crimson"}}>{error}</p>:null}
  {!data?<p>Yükleniyor…</p>:<>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:8,marginTop:14}}>
    {[["Çalışıyor",data.counts?.healthy||0],["Uyarı",data.counts?.warning||0],["Gecikmiş",data.counts?.delayed||0],["Kritik",data.counts?.critical||0],["Karantina",data.counts?.quarantined||0]].map(([k,v])=><div key={k} className="panel" style={{padding:10}}><small style={{opacity:.65}}>{k}</small><div style={{fontSize:22,fontWeight:900}}>{v}</div></div>)}
   </div>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:8,marginTop:12}}>
    {items.map(x=><div key={x.componentKey} className="panel" style={{padding:12}}><div style={{fontWeight:900}}>{x.state==="healthy"?"🟢":x.state==="critical"||x.state==="quarantined"?"🔴":"🟡"} {x.componentKey}</div><div style={{marginTop:5,fontWeight:800}}>{label(x.state)}</div><small style={{display:"block",opacity:.68,marginTop:4}}>Son başarı: {fmt(x.lastSuccessAt)} {x.ageMinutes!==null?"· "+x.ageMinutes+" dk önce":""}</small><small style={{display:"block",opacity:.68}}>Ardışık hata: {x.consecutiveFailures||0} · Beklenen: {x.expectedIntervalMinutes||60} dk</small><small style={{display:"block",opacity:.68}}>Kurtarma denemesi: {x.recoveryAttempts||0}{x.lastRecoveryAt?" · Son: "+fmt(x.lastRecoveryAt):""}</small>{x.quarantineUntil?<small style={{display:"block",fontWeight:800,marginTop:3}}>Karantina bitişi: {fmt(x.quarantineUntil)}</small>:null}{x.detail?<small style={{display:"block",opacity:.68,marginTop:3}}>{x.detail}</small>:null}</div>)}
   </div>
  </>}
 </section>;
}
