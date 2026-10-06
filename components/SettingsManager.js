"use client";
import {useEffect,useState} from "react";
export default function SettingsManager(){
 const [s,setS]=useState(null),[err,setErr]=useState("");
 useEffect(()=>{
   fetch("/api/status",{cache:"no-store"})
     .then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||"Sistem durumu okunamadı.");return d})
     .then(setS)
     .catch(e=>setErr(e.message||"Sistem durumu okunamadı."));
 },[]);
 if(err)return <section className="panel settings"><div><b>Sistem durumu</b><span className="waiting">× {err}</span></div></section>;
 if(!s)return <section className="panel settings"><div><b>Sistem durumu</b><span>Kontrol ediliyor…</span></div></section>;
 const connected=s.providers?.filter(x=>x.status==="connected")||[];
 return <section className="panel settings">
   <div><b>Veritabanı</b><span className={s.database?.configured?"ready":"waiting"}>{s.database?.configured?"● Bağlı":"○ Bağlantı gerekli"}</span></div>
   <div><b>AI sağlayıcıları</b><span className={connected.length?"ready":"waiting"}>{connected.length?connected.map(x=>x.name).join(", "):"Bağlantı gerekli"}</span></div>
   {(s.providers||[]).map(p=><div key={p.name}><b>{p.name}</b><span className={p.status==="connected"?"ready":"waiting"}>{p.status==="connected"?"● Aktif":"○ API anahtarı yok"}</span></div>)}
   <div><b>Yönetici girişi</b><span className={s.auth?.configured?"ready":"waiting"}>{s.auth?.configured?"● Korumalı":"○ ADMIN_PASSWORD + AUTH_SECRET gerekli"}</span></div>
   <div><b>Şifre kurtarma · E-posta</b><span className={s.auth?.recovery?.email?.configured?"ready":"waiting"}>{s.auth?.recovery?.email?.configured?"● Hazır · "+s.auth.recovery.email.masked:"○ Kurulum gerekli"}</span></div>
   <div><b>Şifre kurtarma · Telefon</b><span className={s.auth?.recovery?.phone?.configured?"ready":"waiting"}>{s.auth?.recovery?.phone?.configured?"● Hazır · "+s.auth.recovery.phone.masked:"○ Kurulum gerekli"}</span></div>
   <div><b>Ödeme sistemi</b><span className={s.billing?.configured?"ready":"waiting"}>{s.billing?.configured?"● Hazır":"○ Kart ödeme kapalı"}</span></div>
   {Object.entries(s.integrations||{}).map(([key,x])=><div key={key}><b>{{sms:"SMS kurtarma",card:"PayTR kart",shopier:"Shopier ürünleri",inbox:"Gelen e-posta",cms:"WordPress bağlantısı",budget:"AI bütçesi"}[key]||key}</b><span className={x.configured?"ready":"waiting"}>{x.configured?"● Yapılandırıldı":"○ Eksik: "+x.missing.join(", ")}</span></div>)}
   <div><b>Dış iletişim</b><span>İnsan onayı gerekli</span></div>
 </section>;
}
