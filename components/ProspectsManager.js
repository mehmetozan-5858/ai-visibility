"use client";
import {useEffect,useState} from "react";
export default function ProspectsManager(){
 const [rows,setRows]=useState([]),[open,setOpen]=useState(false),[msg,setMsg]=useState("");
 async function load(){const r=await fetch("/api/prospects",{cache:"no-store"});const d=await r.json();setRows(d.prospects||[])}
 useEffect(()=>{load()},[]);
 async function submit(e){e.preventDefault();setMsg("");const f=e.currentTarget,fd=new FormData(f);const r=await fetch("/api/prospects",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(Object.fromEntries(fd))});const d=await r.json();if(!r.ok){setMsg(d.error);return}f.reset();setOpen(false);setMsg("Aday havuza eklendi.");load()}
 return <section className="panel"><div className="section-title"><div><h2>Potansiyel Müşteriler</h2><small>Satış öncesi aday havuzu · {rows.length} aday</small></div><button onClick={()=>setOpen(!open)}>{open?"Kapat":"＋ Aday ekle"}</button></div>
 <p>Research ajanı için aday havuzu. AI sağlayıcıları bağlandığında görünürlük puanı ve satış gerekçesi otomatik üretilecek; dış iletişim onaydan önce gönderilmeyecek.</p>
 {open&&<form className="client-form" onSubmit={submit}><label>İşletme adı<input name="name" required/></label><label>Web sitesi<input name="domain" placeholder="ornek.com"/></label><label>Sektör<input name="sector" placeholder="Diş kliniği, otel..."/></label><label>Şehir<input name="city" defaultValue="Sivas"/></label><input type="hidden" name="source" value="research"/><button>Adayı kaydet</button></form>}
 {msg&&<p className="client-message">{msg}</p>}
 {rows.length===0?<div className="empty">Henüz aday yok. İlk adayları ekleyip tarama sırasına alacağız.</div>:<div className="client-list">{rows.map(x=><article className="client-row" key={x.id}><div className="client-avatar">⌕</div><div><b>{x.name}</b><small>{[x.sector,x.city,x.domain].filter(Boolean).join(" · ")}</small></div><span>{x.score==null?"Tarama bekliyor":x.score+"/100"}</span><em>{x.status==="new"?"Yeni":x.status}</em></article>)}</div>}
 </section>
}