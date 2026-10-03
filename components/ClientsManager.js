"use client";
import {useEffect,useState} from "react";

export default function ClientsManager(){
 const [clients,setClients]=useState([]),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[msg,setMsg]=useState("");

 async function load(){
   setLoading(true);
   try{
     const r=await fetch("/api/clients",{cache:"no-store"});
     const d=await r.json();
     if(!r.ok) throw new Error(d.error||"Müşteriler okunamadı.");
     setClients(d.clients||[]);
   }catch(e){setMsg(e.message||"Müşteriler okunamadı.");}
   finally{setLoading(false);}
 }
 useEffect(()=>{load()},[]);

 async function submit(e){
   e.preventDefault();setBusy(true);setMsg("");
   const form=e.currentTarget,fd=new FormData(form);
   const competitors=(fd.get("competitors")||"").split(",").map(x=>x.trim()).filter(Boolean);
   try{
     const r=await fetch("/api/clients",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({
       name:fd.get("name"),domain:fd.get("domain"),plan:fd.get("plan"),competitors,
       country:fd.get("country"),city:fd.get("city"),sector:fd.get("sector"),contactEmail:fd.get("contactEmail"),phone:fd.get("phone")
     })});
     const d=await r.json();
     if(!r.ok) throw new Error(d.error||"Kaydedilemedi.");
     if(d.mode!=="database") throw new Error("Veritabanı bağlantısı aktif değil; kayıt kalıcı olmadı.");
     form.reset();setOpen(false);setMsg("Müşteri ve işletme profili Neon veritabanına kalıcı olarak kaydedildi.");await load();
   }catch(e){setMsg(e.message||"Kaydedilemedi.");}
   finally{setBusy(false);}
 }

 return <section className="panel clients-manager">
   <div className="section-title"><div><h2>Müşteri listesi</h2><small>{clients.length} kayıt</small></div><button onClick={()=>{setOpen(!open);setMsg("")}}>{open?"Kapat":"＋ Yeni müşteri"}</button></div>
   {open&&<form onSubmit={submit} className="client-form">
     <label>Marka / işletme adı<input name="name" placeholder="Örn. Acme" required/></label>
     <label>Web sitesi<input name="domain" inputMode="url" placeholder="ornek.com" required/></label>
     <label>Ülke<input name="country" placeholder="Türkiye"/></label>
     <label>Şehir<input name="city" placeholder="Sivas"/></label>
     <label>Sektör<input name="sector" placeholder="Otel, restoran, tekstil..."/></label>
     <label>İletişim e-postası<input name="contactEmail" type="email" placeholder="info@ornek.com"/></label>
     <label>Telefon / WhatsApp<input name="phone" placeholder="+90..."/></label>
     <label>Rakipler<input name="competitors" placeholder="rakip1.com, rakip2.com"/></label>
     <label>Paket<select name="plan" defaultValue="Starter"><option>Starter</option><option>Pro</option></select></label>
     <button disabled={busy}>{busy?"Kaydediliyor...":"Müşteriyi kaydet"}</button>
   </form>}
   {msg&&<p className="client-message">{msg}</p>}
   {loading?<div className="empty">Müşteriler yükleniyor…</div>:clients.length===0?
     <div className="empty tall"><b>Henüz gerçek müşteri yok.</b><span>“Yeni müşteri” ile eklediğiniz kayıt Neon veritabanında kalıcı tutulacak.</span></div>:
     <div className="client-list">{clients.map(c=><article className="client-row" key={c.id}>
       <div className="client-avatar">{(c.name||"?").slice(0,1).toUpperCase()}</div>
       <div><b>{c.name}</b><small>{c.domain}</small><small>{[c.profile?.sector,c.profile?.city,c.profile?.country].filter(Boolean).join(" · ")}</small></div>
       <span>{c.plan}</span><em>{c.status==="active"?"Aktif":c.status}</em>
     </article>)}</div>}
 </section>;
}
