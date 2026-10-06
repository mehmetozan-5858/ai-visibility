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
  const [items,setItems]=useState([]),[busy,setBusy]=useState(""),[msg,setMsg]=useState(""),[deliveries,setDeliveries]=useState({});
  async function load(){
    const r=await fetch("/api/work-items",{cache:"no-store"}),d=await r.json();
    if(r.ok)setItems(d.items||[]);
    const cr=await fetch("/api/cms/drafts",{cache:"no-store"}),cd=await cr.json();if(cr.ok)setDeliveries(Object.fromEntries((cd.deliveries||[]).map(x=>[x.workId,x])));
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
  async function deliver(id){setBusy(id);setMsg("");try{const r=await fetch("/api/cms/drafts",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({workId:id,approved:true})});const d=await r.json();if(!r.ok)throw new Error(d.error);setMsg(d.status==="draft-created"?"WordPress taslağı oluşturuldu. Yayın için müşteri incelemesi gerekiyor.":"Önceki teslimi WordPress üzerinde kontrol edin.");await load()}catch(e){setMsg(e.message);await load()}finally{setBusy("")}}
  return <section className="panel">
    <div className="section-title"><div><h2>İş ve Onay Merkezi</h2><small>Uygulama Ajanı görevlerinin gerçek durumu</small></div></div>
    {msg&&<p className="client-message">{msg}</p>}
    {!items.length?<div className="empty">Henüz uygulama görevi yok. Raporlar → Uygulama Ajanı → Eksikleri uygula ile oluşturabilirsiniz.</div>:
    <div className="client-list">{items.map(x=><article className="client-row" key={x.id}>
      <div className="client-avatar">{x.status==="completed"?"✓":"⚙"}</div>
      <div><b>{x.clientName} · {x.title}</b><small>{x.category}{x.detail?" · "+x.detail:""}</small></div>
      <span>{labels[x.status]||x.status}</span>
      {deliveries[x.id]?.editUrl?<a href={deliveries[x.id].editUrl} target="_blank" rel="noopener noreferrer">WordPress taslağını incele</a>:deliveries[x.id]?<small>Teslim kontrolü gerekiyor</small>:x.status==="ready"&&/content|içerik|icerik|faq|soru|location|lokasyon/i.test(x.title)&&<button disabled={busy===x.id} onClick={()=>deliver(x.id)}>WordPress taslağı oluştur</button>}
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
