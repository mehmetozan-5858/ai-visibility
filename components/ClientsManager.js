"use client";
import {useEffect,useState} from "react";
export default function ClientsManager(){
 const [clients,setClients]=useState([]),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[msg,setMsg]=useState("");
 async function load(){const r=await fetch("/api/clients",{cache:"no-store"});const d=await r.json();setClients(d.clients||[])}
 useEffect(()=>{load()},[]);
 async function submit(e){e.preventDefault();setBusy(true);setMsg("");const fd=new FormData(e.currentTarget);const competitors=(fd.get("competitors")||"").split(",").map(x=>x.trim()).filter(Boolean);const r=await fetch("/api/clients",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name:fd.get("name"),domain:fd.get("domain"),plan:fd.get("plan"),competitors})});const d=await r.json();setBusy(false);if(!r.ok){setMsg(d.error||"Kaydedilemedi");return}if(d.mode!=="database"){setMsg("Veritabanı henüz bağlı değil; kayıt kalıcı olmadı.");return}e.currentTarget.reset();setOpen(false);await load()}
 return <section className="panel"><div className="section-title"><h2>Müşteri listesi</h2><button onClick={()=>setOpen(!open)}>＋ Yeni müşteri</button></div>
 {open&&<form onSubmit={submit} style={{display:"grid",gap:10,margin:"16px 0"}}><input name="name" placeholder="Marka / işletme adı" required/><input name="domain" placeholder="ornek.com" required/><input name="competitors" placeholder="Rakipler: rakip1.com, rakip2.com"/><select name="plan" defaultValue="Starter"><option>Starter</option><option>Pro</option></select><button disabled={busy}>{busy?"Kaydediliyor...":"Müşteriyi kaydet"}</button></form>}
 {msg&&<p>{msg}</p>}
 {clients.length===0?<div className="empty tall"><b>Henüz gerçek müşteri yok.</b><span>İlk müşteriyi eklediğinizde marka, domain, paket ve görünürlük skoru burada görünecek.</span></div>:<div style={{display:"grid",gap:10}}>{clients.map(c=><div className="panel" key={c.id}><b>{c.name}</b><div>{c.domain} · {c.plan} · {c.status}</div></div>)}</div>}</section>
}