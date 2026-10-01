"use client";
import {useEffect,useState} from "react";

export default function ProspectsManager(){
 const [rows,setRows]=useState([]),[open,setOpen]=useState(false),[msg,setMsg]=useState(""),[discovering,setDiscovering]=useState(false),[scanning,setScanning]=useState(""),[converting,setConverting]=useState("");

 async function load(){
   const r=await fetch("/api/prospects",{cache:"no-store"});
   const d=await r.json();
   setRows(d.prospects||[]);
 }

 useEffect(()=>{load()},[]);

 async function discover(){
   setDiscovering(true);setMsg("");
   try{
     const r=await fetch("/api/prospects/discover",{method:"POST"});
     const d=await r.json();
     if(!r.ok)throw new Error(d.error||"Keşif başarısız.");
     setMsg(d.count+" araştırma adayı havuza işlendi.");
     await load();
   }catch(e){setMsg(e.message)}
   finally{setDiscovering(false)}
 }

 async function scan(id){
   setScanning(id);setMsg("");
   try{
     const r=await fetch(`/api/prospects/${id}/scan`,{method:"POST"});
     const d=await r.json();
     if(!r.ok)throw new Error(d.error||"Tarama başlatılamadı.");
     setMsg("AI tarama kuyruğa alındı. Canlı sağlayıcı bağlanınca sonuç otomatik tamamlanacak.");
     await load();
   }catch(e){setMsg(e.message)}
   finally{setScanning("")}
 }

 async function convertAndScan(id){
   setConverting(id);setMsg("");
   try{
     const r=await fetch(`/api/prospects/${id}/convert`,{method:"POST"});
     const d=await r.json();
     if(!r.ok)throw new Error(d.error||"Müşteriye dönüştürme başarısız.");
     setMsg(d.live
       ? `Müşteri hazır · ${d.provider} taraması tamamlandı · skor ${d.scan?.score??"—"}/100`
       : (d.note||"Müşteri oluşturuldu ve tarama kuyruğa alındı."));
     await load();
   }catch(e){setMsg(e.message)}
   finally{setConverting("")}
 }

 async function submit(e){
   e.preventDefault();setMsg("");
   const f=e.currentTarget,fd=new FormData(f);
   const r=await fetch("/api/prospects",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(Object.fromEntries(fd))});
   const d=await r.json();
   if(!r.ok){setMsg(d.error);return}
   f.reset();setOpen(false);setMsg("Aday havuza eklendi.");load();
 }

 return <section className="panel">
   <div className="section-title">
     <div><h2>Potansiyel Müşteriler</h2><small>Satış öncesi aday havuzu · {rows.length} aday</small></div>
     <div style={{display:"flex",gap:7}}>
       <button onClick={discover} disabled={discovering}>{discovering?"Bulunuyor…":"⌕ Adayları bul"}</button>
       <button onClick={()=>setOpen(!open)}>{open?"Kapat":"＋ Aday ekle"}</button>
     </div>
   </div>
   <p>Research ajanı adayları toplar. “AI Tara” analizi kuyruğa alır. Canlı AI sağlayıcıları bağlanmadan sahte puan üretilmez; dış iletişim de onaydan önce gönderilmez.</p>

   {open&&<form className="client-form" onSubmit={submit}>
     <label>İşletme adı<input name="name" required/></label>
     <label>Web sitesi<input name="domain" placeholder="ornek.com"/></label>
     <label>Sektör<input name="sector" placeholder="Diş kliniği, otel..."/></label>
     <label>Şehir<input name="city" defaultValue="Sivas"/></label>
     <input type="hidden" name="source" value="research"/>
     <button>Adayı kaydet</button>
   </form>}

   {msg&&<p className="client-message">{msg}</p>}

   {rows.length===0?<div className="empty">Henüz aday yok. İlk adayları ekleyip tarama sırasına alacağız.</div>:
   <div className="client-list">{rows.map(x=><article className="client-row prospect-row" key={x.id}>
     <div className="client-avatar">⌕</div>
     <div><b>{x.name}</b><small>{[x.sector,x.city,x.domain].filter(Boolean).join(" · ")}</small></div>
     <span>{x.score==null?(x.scanStatus==="awaiting-provider"?"Kuyrukta":"Tarama bekliyor"):x.score+"/100"}</span>
     <button onClick={()=>convertAndScan(x.id)} disabled={converting===x.id}>{converting===x.id?"Hazırlanıyor…":x.status==="converted"?"↻ Tekrar Tara":"＋ Müşteriye dönüştür + Tara"}</button>
   </article>)}</div>}
 </section>;
}
