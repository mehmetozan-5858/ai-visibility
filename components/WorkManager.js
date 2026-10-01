"use client";
import {useEffect,useState} from "react";

const labels={
  "ready":"Hazır",
  "access-required":"Erişim bekliyor",
  "approval-required":"Müşteri onayı bekliyor",
  "in-progress":"Uygulanıyor",
  "completed":"Tamamlandı"
};

export default function WorkManager(){
  const [items,setItems]=useState([]),[busy,setBusy]=useState(""),[msg,setMsg]=useState("");
  async function load(){
    const r=await fetch("/api/work-items",{cache:"no-store"}),d=await r.json();
    if(r.ok)setItems(d.items||[]);
  }
  useEffect(()=>{load()},[]);
  async function setStatus(id,status){
    setBusy(id);setMsg("");
    try{
      const r=await fetch("/api/work-items",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id,status})});
      const d=await r.json();if(!r.ok)throw new Error(d.error||"Güncellenemedi.");
      await load();
    }catch(e){setMsg(e.message)}finally{setBusy("")}
  }
  return <section className="panel">
    <div className="section-title"><div><h2>İş ve Onay Merkezi</h2><small>Uygulama Ajanı görevlerinin gerçek durumu</small></div></div>
    {msg&&<p className="client-message">{msg}</p>}
    {!items.length?<div className="empty">Henüz uygulama görevi yok. Raporlar → Uygulama Ajanı → Eksikleri uygula ile oluşturabilirsiniz.</div>:
    <div className="client-list">{items.map(x=><article className="client-row" key={x.id}>
      <div className="client-avatar">{x.status==="completed"?"✓":"⚙"}</div>
      <div><b>{x.clientName} · {x.title}</b><small>{x.category}{x.detail?" · "+x.detail:""}</small></div>
      <span>{labels[x.status]||x.status}</span>
      <select value={x.status} disabled={busy===x.id} onChange={e=>setStatus(x.id,e.target.value)} style={{background:"#071923",color:"#fff",border:"1px solid #24506a",borderRadius:10,padding:"9px"}}>
        <option value="ready">Hazır</option>
        <option value="approval-required">Müşteri onayı bekliyor</option>
        <option value="access-required">Erişim bekliyor</option>
        <option value="in-progress">Uygulanıyor</option>
        <option value="completed">Tamamlandı</option>
      </select>
    </article>)}</div>}
  </section>;
}
